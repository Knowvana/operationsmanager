// ============================================================================
// PlatformDashboard — The main authenticated view after login.
//
// ARCHITECTURE NOTE:
// This renders inside the AppShell layout. The DatabaseSetupWizard
// opens as a modal OVER this layout, so the admin always sees the
// platform structure behind it.
//
// Settings is rendered INLINE using the shared SettingsConfig component
// (not as a modal). Logs has its own dedicated viewer page.
// ============================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { AppShell, Card, PageHeader, EmptyState, Button, Logger, SettingsConfig } from '@shared';
import {
  LayoutDashboard, Users, Building2, Settings,
  Activity, Shield, Database, CheckCircle2,
  ScrollText, Save, HardDrive, RefreshCw, ExternalLink,
  Server, Wifi, WifiOff, Clock, BarChart3, AlertTriangle,
  Cpu, HardDrive as HDD, FileText, Layers, ArrowUpRight,
  TrendingUp, Zap, Package, CircleDot
} from 'lucide-react';
import DatabaseSetupWizard from './setup/DatabaseSetupWizard';
import LogsViewer from './views/LogsViewer';
import firebaseConfig from '@config/firebase.json';
import databaseSchema from '@config/database-schema.json';
import appConfig from '@config/app.json';

// Side nav items for the System Admin dashboard
const ADMIN_NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { id: 'tenants',   label: 'Tenants',      icon: Building2 },
  { id: 'users',     label: 'Users',        icon: Users },
  { id: 'modules',   label: 'Modules',      icon: Activity },
  { id: 'logs',      label: 'Logs',         icon: ScrollText },
  { id: 'settings',  label: 'Settings',     icon: Settings },
];

export default function PlatformDashboard({ user, onLogout, appName, isDatabaseReady = false, onDatabaseReady }) {
  const [activeView, setActiveView] = useState('overview');
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  // --- Database Config State (editable) ---
  const [dbConfig, setDbConfig] = useState({
    rootCollection: databaseSchema.root_collection,
    rootDocument: databaseSchema.root_document,
    firestoreUrl: databaseSchema.firestore_console_url || '',
    collections: Object.entries(databaseSchema.collections).map(([key, col]) => ({
      key,
      path: col.path,
      description: col.description,
      fieldCount: Object.keys(col.fields).length,
    })),
  });
  const [dbConfigSaved, setDbConfigSaved] = useState(false);

  // --- Logging Config State ---
  const [logConfig, setLogConfig] = useState(() => Logger.getConfig());
  const [logStoragePath, setLogStoragePath] = useState(
    `${databaseSchema.root_collection}/${databaseSchema.root_document}/SystemLogs`
  );
  const [logConfigSaved, setLogConfigSaved] = useState(false);

  const handleDatabaseSetupComplete = () => {
    setIsSetupWizardOpen(false);
    onDatabaseReady?.();
    Logger.info('Platform', 'Database setup completed');
  };

  const handleSaveDbConfig = () => {
    Logger.info('Settings', 'Database configuration saved', dbConfig);
    setDbConfigSaved(true);
    setTimeout(() => setDbConfigSaved(false), 2000);
  };

  const handleSaveLogConfig = () => {
    Logger.updateConfig(logConfig);
    Logger.info('Settings', 'Logging configuration saved', { ...logConfig, storagePath: logStoragePath });
    setLogConfigSaved(true);
    setTimeout(() => setLogConfigSaved(false), 2000);
  };

  const updateCollectionPath = (index, newPath) => {
    setDbConfig((prev) => {
      const cols = [...prev.collections];
      cols[index] = { ...cols[index], path: newPath };
      return { ...prev, collections: cols };
    });
  };

  // Log navigation
  useEffect(() => {
    Logger.info('Navigation', `Navigated to ${activeView}`);
  }, [activeView]);

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return renderOverview();

      case 'tenants':
        return (
          <div className="animate-fade-in">
            <PageHeader title="Tenant Management" subtitle="Manage organizations and subscriptions" icon={Building2} />
            <EmptyState
              icon={<Building2 size={40} className="text-surface-300" />}
              title="No tenants yet"
              description="Create your first tenant to start onboarding organizations."
              action={<Button icon={<Building2 size={16} />}>Create Tenant</Button>}
            />
          </div>
        );

      case 'users':
        return (
          <div className="animate-fade-in">
            <PageHeader title="User Management" subtitle="Manage platform users and access" icon={Users} />
            <EmptyState
              icon={<Users size={40} className="text-surface-300" />}
              title="No tenant users yet"
              description="Users will appear here once tenants are created and users are added."
            />
          </div>
        );

      case 'modules':
        return (
          <div className="animate-fade-in">
            <PageHeader title="Module Registry" subtitle="Available modules for tenant subscriptions" icon={Activity} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModuleCard
                name="Operations Monitor"
                description="Real-time operations monitoring with shift-based task management"
                status="Available"
                version="1.0.0"
              />
              <ModuleCard
                name="Shift Roster Planner"
                description="Workforce scheduling and roster management"
                status="Coming Soon"
                version="1.0.0"
              />
            </div>
          </div>
        );

      case 'logs':
        return <LogsViewer />;

      case 'settings':
        return (
          <div className="animate-fade-in" style={{ height: 'calc(100vh - 140px)' }}>
            <SettingsConfig
              title="Platform Settings"
              subtitle="Global configuration — App Admin only"
              icon={Settings}
              defaultTab="database"
              tabs={[
                { id: 'database', label: 'Database', icon: Database, content: renderDatabaseTab() },
                { id: 'logging', label: 'Logging', icon: ScrollText, content: renderLoggingTab() },
                { id: 'security', label: 'Security', icon: Shield, content: renderSecurityTab() },
              ]}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // --- Overview ---

  // Computed stats for overview
  const logStats = useMemo(() => {
    const logs = Logger.getSystemLogs();
    const apiLogs = Logger.getApiLogs();
    const errors = logs.filter((l) => l.level === 'error').length;
    const warnings = logs.filter((l) => l.level === 'warn').length;
    const last5 = logs.slice(0, 5);
    return { total: logs.length, apiTotal: apiLogs.length, errors, warnings, last5 };
  }, [activeView]); // recalculate when navigating back to overview

  const collectionCount = Object.keys(databaseSchema.collections).length;
  const moduleCollectionCount = Object.keys(databaseSchema.module_collections || {}).length;
  const totalFields = Object.values(databaseSchema.collections).reduce(
    (sum, col) => sum + Object.keys(col.fields).length, 0
  );

  function renderOverview() {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Platform Overview"
          subtitle={`Welcome back, ${user?.displayName || 'Administrator'}`}
          icon={LayoutDashboard}
        />

        {/* Row 1: Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Zap size={20} className="text-emerald-500" />}
            label="System Health"
            value="Operational"
            gradient="from-emerald-50 to-teal-50"
            detail="All services running"
          />
          <StatCard
            icon={<Database size={20} className="text-brand-500" />}
            label="Database"
            value={isDatabaseReady ? 'Connected' : 'Not Setup'}
            gradient={isDatabaseReady ? 'from-brand-50 to-blue-50' : 'from-amber-50 to-orange-50'}
            detail={isDatabaseReady ? firebaseConfig.projectId : 'Run Setup Wizard'}
          />
          <StatCard
            icon={<Package size={20} className="text-violet-500" />}
            label="Total Modules"
            value="2"
            gradient="from-violet-50 to-purple-50"
            detail="1 active, 1 coming soon"
          />
          <StatCard
            icon={<ScrollText size={20} className="text-amber-500" />}
            label="Log Entries"
            value={String(logStats.total)}
            gradient="from-amber-50 to-orange-50"
            detail={`${logStats.errors} errors, ${logStats.warnings} warnings`}
          />
        </div>

        {/* Row 2: DB Objects + System Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Database Objects */}
          <Card variant="elevated" className="p-5 col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
                <HDD size={15} className="text-brand-500" />
                Database Objects
              </h3>
              {isDatabaseReady && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">CONNECTED</span>
              )}
            </div>
            <div className="space-y-2.5">
              <MiniStat label="Root Collection" value={databaseSchema.root_collection} mono />
              <MiniStat label="Root Document" value={databaseSchema.root_document} mono />
              <MiniStat label="Collections" value={String(collectionCount)} />
              <MiniStat label="Total Fields" value={String(totalFields)} />
              <MiniStat label="Module Collections" value={String(moduleCollectionCount)} />
              <MiniStat label="Provider" value="Firebase Firestore" />
              <MiniStat label="Project ID" value={firebaseConfig.projectId || '—'} mono />
            </div>
            {!isDatabaseReady && (
              <Button
                variant="primary"
                size="sm"
                className="w-full mt-4"
                icon={<Database size={14} />}
                onClick={() => setIsSetupWizardOpen(true)}
              >
                Run Setup Wizard
              </Button>
            )}
          </Card>

          {/* Platform Configuration Status */}
          <Card variant="elevated" className="p-5 col-span-1">
            <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
              <Settings size={15} className="text-brand-500" />
              Configuration Status
            </h3>
            <div className="space-y-3">
              <StatusRow label="Database Setup" done={isDatabaseReady} />
              <StatusRow label="Firebase Connected" done={isDatabaseReady} />
              <StatusRow label="Admin Account" done={true} />
              <StatusRow label="Logging Active" done={true} />
              <StatusRow label="First Tenant Created" done={false} />
              <StatusRow label="Users Onboarded" done={false} />
              <StatusRow label="Module Subscriptions" done={false} />
            </div>
            <div className="mt-4 pt-3 border-t border-surface-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-400">Setup Progress</span>
                <span className="text-xs font-bold text-brand-600">
                  {[isDatabaseReady, isDatabaseReady, true, true, false, false, false].filter(Boolean).length}/7
                </span>
              </div>
              <div className="w-full h-2 bg-surface-100 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${([isDatabaseReady, isDatabaseReady, true, true, false, false, false].filter(Boolean).length / 7) * 100}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Logging Overview */}
          <Card variant="elevated" className="p-5 col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
                <BarChart3 size={15} className="text-brand-500" />
                Logging Summary
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">IN-MEMORY</span>
            </div>
            <div className="space-y-2.5">
              <MiniStat label="Total Logs" value={String(logStats.total)} />
              <MiniStat label="API Calls Tracked" value={String(logStats.apiTotal)} />
              <MiniStat label="Errors" value={String(logStats.errors)} valueColor={logStats.errors > 0 ? 'text-rose-600' : undefined} />
              <MiniStat label="Warnings" value={String(logStats.warnings)} valueColor={logStats.warnings > 0 ? 'text-amber-600' : undefined} />
              <MiniStat label="Flush Buffer" value={`${Logger.getFlushBufferSize()} pending`} />
              <MiniStat label="Min Level" value={Logger.getConfig().minLevel} />
              <MiniStat label="Session" value={Logger.getSessionId().substring(0, 16) + '...'} mono />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-4"
              icon={<ScrollText size={14} />}
              onClick={() => setActiveView('logs')}
            >
              View All Logs
            </Button>
          </Card>
        </div>

        {/* Row 3: Recent Activity + Platform Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <Card variant="elevated" className="p-5">
            <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
              <Clock size={15} className="text-brand-500" />
              Recent Activity
            </h3>
            {logStats.last5.length === 0 ? (
              <p className="text-xs text-surface-400 italic">No recent activity.</p>
            ) : (
              <div className="space-y-2">
                {logStats.last5.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 py-1.5 border-b border-surface-50 last:border-0">
                    <div className={`
                      w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0
                      ${log.level === 'error' ? 'bg-rose-500' : log.level === 'warn' ? 'bg-amber-500' : log.level === 'info' ? 'bg-blue-500' : 'bg-surface-300'}
                    `} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-700 truncate">{log.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-surface-400">{log.source}</span>
                        <span className="text-[10px] text-surface-300">•</span>
                        <span className="text-[10px] text-surface-400">{log.user}</span>
                        <span className="text-[10px] text-surface-300">•</span>
                        <span className="text-[10px] text-surface-300">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                        </span>
                      </div>
                    </div>
                    <span className={`
                      text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
                      ${log.result === 'success' ? 'bg-emerald-50 text-emerald-600' : log.result === 'failure' ? 'bg-rose-50 text-rose-600' : 'bg-surface-50 text-surface-400'}
                    `}>
                      {log.result}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Platform Information */}
          <Card variant="elevated" className="p-5">
            <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
              <Layers size={15} className="text-brand-500" />
              Platform Information
            </h3>
            <div className="space-y-2.5">
              <MiniStat label="Platform" value={appConfig.appName || appName} />
              <MiniStat label="Version" value={appConfig.appVersion || '1.0.0'} mono />
              <MiniStat label="Environment" value="Development" />
              <MiniStat label="Framework" value="React 18 + Vite 5" />
              <MiniStat label="UI Library" value="Tailwind CSS 3" />
              <MiniStat label="Backend" value="Firebase 10" />
              <MiniStat label="Logged In As" value={user?.email || '—'} mono />
              <MiniStat label="Role" value={user?.role?.replace('_', ' ') || '—'} />
            </div>
            {databaseSchema.firestore_console_url && (
              <a
                href={databaseSchema.firestore_console_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
              >
                <ExternalLink size={13} />
                Open Firestore Console
              </a>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // --- Settings Tab Content Renderers ---

  function renderDatabaseTab() {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-base font-bold text-surface-800 mb-1">Database Configuration</h3>
          <p className="text-sm text-surface-400">Manage your Firebase Firestore connection and database structure.</p>
        </div>

        {/* Connection Status */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Connection Status</h4>
          <div className="space-y-2.5">
            <SettingsRow
              label="Status"
              value={isDatabaseReady ? 'Connected' : 'Not configured'}
              valueColor={isDatabaseReady ? 'text-emerald-600' : 'text-amber-600'}
            />
            <SettingsRow label="Provider" value="Firebase Firestore" />
            <SettingsRow label="Project ID" value={firebaseConfig.projectId || '—'} mono />
            <SettingsRow label="Auth Domain" value={firebaseConfig.authDomain || '—'} mono />
          </div>
        </Card>

        {/* Editable Database Structure */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Database Structure</h4>
          <div className="space-y-3">
            <EditableField
              label="Root Collection"
              value={dbConfig.rootCollection}
              onChange={(v) => setDbConfig((p) => ({ ...p, rootCollection: v }))}
            />
            <EditableField
              label="Database Name (Root Document)"
              value={dbConfig.rootDocument}
              onChange={(v) => setDbConfig((p) => ({ ...p, rootDocument: v }))}
            />
            <EditableField
              label="Firestore Console URL"
              value={dbConfig.firestoreUrl}
              onChange={(v) => setDbConfig((p) => ({ ...p, firestoreUrl: v }))}
            />
            <SettingsRow
              label="Document Path"
              value={`${dbConfig.rootCollection}/${dbConfig.rootDocument}`}
              mono
            />
          </div>
        </Card>

        {/* Editable Collections */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Collections</h4>
          <div className="space-y-3">
            {dbConfig.collections.map((col, idx) => (
              <div key={col.key} className="flex items-center gap-3 py-2 border-b border-surface-50 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-surface-400 bg-surface-50 px-1.5 py-0.5 rounded">{col.key}</span>
                    <span className="text-[10px] text-surface-300">{col.fieldCount} fields</span>
                  </div>
                  <input
                    type="text"
                    value={col.path}
                    onChange={(e) => updateCollectionPath(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all font-mono"
                  />
                  <p className="text-[10px] text-surface-400 mt-1">{col.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant={dbConfigSaved ? 'success' : 'primary'}
            size="sm"
            icon={dbConfigSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            onClick={handleSaveDbConfig}
          >
            {dbConfigSaved ? 'Saved!' : 'Save Configuration'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Database size={14} />}
            onClick={() => setIsSetupWizardOpen(true)}
          >
            {isDatabaseReady ? 'Reconfigure' : 'Run Setup Wizard'}
          </Button>
          {dbConfig.firestoreUrl && (
            <a
              href={dbConfig.firestoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
            >
              <ExternalLink size={13} />
              Open Firestore Console
            </a>
          )}
        </div>
      </div>
    );
  }

  function renderLoggingTab() {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-base font-bold text-surface-800 mb-1">Logging Configuration</h3>
          <p className="text-sm text-surface-400">Control what gets logged across the platform. Only App Admins can modify these settings.</p>
        </div>

        {/* Log Level */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Log Level</h4>
          <p className="text-xs text-surface-500 mb-2">Only logs at or above this level will be captured.</p>
          <div className="flex items-center gap-1.5">
            {Logger.getLogLevels().map((level) => (
              <button
                key={level}
                onClick={() => setLogConfig((c) => ({ ...c, minLevel: level }))}
                className={`
                  px-3 py-2 rounded-lg text-xs font-semibold transition-all capitalize
                  ${logConfig.minLevel === level
                    ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                    : 'bg-surface-50 text-surface-400 hover:bg-surface-100 hover:text-surface-600'
                  }
                `}
              >
                {level}
              </button>
            ))}
          </div>
        </Card>

        {/* Capture Options */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Capture Options</h4>
          <div className="space-y-3">
            <ToggleRow
              label="Console Output"
              description="Mirror logs to the browser developer console"
              checked={logConfig.consoleOutput}
              onChange={(v) => setLogConfig((c) => ({ ...c, consoleOutput: v }))}
            />
            <ToggleRow
              label="Capture API Calls"
              description="Track all Firebase and backend API requests"
              checked={logConfig.captureApiCalls}
              onChange={(v) => setLogConfig((c) => ({ ...c, captureApiCalls: v }))}
            />
            <ToggleRow
              label="Capture Timestamps"
              description="Include ISO timestamps in every log entry"
              checked={logConfig.captureTimestamps}
              onChange={(v) => setLogConfig((c) => ({ ...c, captureTimestamps: v }))}
            />
          </div>
        </Card>

        {/* Buffer Settings */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Buffer Settings</h4>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-1">Max In-Memory Entries</label>
              <input
                type="number"
                min={50}
                max={5000}
                step={50}
                value={logConfig.maxBufferSize}
                onChange={(e) => setLogConfig((c) => ({ ...c, maxBufferSize: parseInt(e.target.value) || 500 }))}
                className="w-28 px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
              />
            </div>
            <p className="text-[10px] text-surface-400 mt-5">
              Oldest entries are discarded when the buffer is full.
            </p>
          </div>
        </Card>

        {/* Log Storage (Database) */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3 flex items-center gap-2">
            <HardDrive size={13} />
            Log Storage
          </h4>
          <p className="text-xs text-surface-500 mb-3">
            Logs are persisted to the database for audit trails and historical analysis.
          </p>
          <div className="space-y-3">
            <SettingsRow label="Storage Provider" value="Firebase Firestore" />
            <SettingsRow label="Project ID" value={firebaseConfig.projectId || '—'} mono />
            <EditableField
              label="Collection Path"
              value={logStoragePath}
              onChange={setLogStoragePath}
            />
            <SettingsRow label="Persistence" value="In-Memory Only" valueColor="text-amber-600" />
          </div>
          <p className="text-[10px] text-surface-300 mt-3 italic">
            Database persistence will be enabled in a future release.
          </p>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant={logConfigSaved ? 'success' : 'primary'}
            size="sm"
            icon={logConfigSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            onClick={handleSaveLogConfig}
          >
            {logConfigSaved ? 'Saved!' : 'Save Configuration'}
          </Button>
          <span className="text-[10px] text-surface-300">Changes take effect immediately.</span>
        </div>
      </div>
    );
  }

  function renderSecurityTab() {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-base font-bold text-surface-800 mb-1">Security & Access</h3>
          <p className="text-sm text-surface-400">Authentication, authorization, and access control settings.</p>
        </div>

        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Authentication</h4>
          <div className="space-y-2.5">
            <SettingsRow label="Admin Auth" value="JSON Config" />
            <SettingsRow label="Tenant Auth" value="Firebase Auth (Pending)" valueColor="text-amber-600" />
            <SettingsRow label="Session" value="In-Memory (Browser)" />
          </div>
        </Card>

        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Access Control</h4>
          <div className="space-y-2.5">
            <SettingsRow label="Admin URL" value="/admin-setup" mono />
            <SettingsRow label="Tenant URL" value="/" mono />
            <SettingsRow label="RBAC" value="Role-Based (Future)" valueColor="text-surface-400" />
          </div>
        </Card>

        <p className="text-[10px] text-surface-300 italic">
          Advanced security settings will be available in future releases.
        </p>
      </div>
    );
  }

  return (
    <AppShell
      appName={appName}
      modules={[]}
      activeModuleId={null}
      onSwitchModule={() => {}}
      onLogout={onLogout}
      user={user}
      sideNavTitle="Administration"
      sideNavItems={ADMIN_NAV_ITEMS}
      activeSideNavItemId={activeView}
      onSelectSideNavItem={setActiveView}
    >
      {renderContent()}

      {/* Database Setup Wizard — opens as modal over the AppShell */}
      <DatabaseSetupWizard
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        onComplete={handleDatabaseSetupComplete}
      />
    </AppShell>
  );
}

// --- Local sub-components (only used in this file) ---

function StatCard({ icon, label, value, gradient, detail }) {
  return (
    <Card variant="default" className={`p-5 bg-gradient-to-br ${gradient}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-white/80 shadow-sm">{icon}</div>
      </div>
      <p className="text-2xl font-extrabold text-surface-800">{value}</p>
      <p className="text-xs font-medium text-surface-500 mt-0.5">{label}</p>
      {detail && <p className="text-[10px] text-surface-400 mt-1">{detail}</p>}
    </Card>
  );
}

function MiniStat({ label, value, mono = false, valueColor }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className={`text-[11px] font-semibold ${valueColor || 'text-surface-700'} ${mono ? 'font-mono' : ''} truncate max-w-[180px]`}>{value}</span>
    </div>
  );
}

function StatusRow({ label, done }) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? (
        <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-surface-200 flex-shrink-0" />
      )}
      <span className={`text-xs ${done ? 'text-surface-600' : 'text-surface-400'}`}>{label}</span>
    </div>
  );
}

function SettingsRow({ label, value, valueColor = 'text-surface-700', mono = false }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-surface-500">{label}</span>
      <span className={`text-xs font-semibold ${valueColor} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function EditableField({ label, value, onChange }) {
  return (
    <div className="py-1">
      <label className="block text-xs font-semibold text-surface-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all font-mono"
      />
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <p className="text-xs font-semibold text-surface-600">{label}</p>
        {description && <p className="text-[10px] text-surface-400">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0
          ${checked ? 'bg-brand-500' : 'bg-surface-200'}
        `}
      >
        <span className={`
          absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
          transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `} />
      </button>
    </div>
  );
}

function ModuleCard({ name, description, status, version }) {
  const isAvailable = status === 'Available';
  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-brand-50 to-teal-50">
          <Activity size={18} className="text-brand-600" />
        </div>
        <span className={`
          text-[10px] font-bold uppercase px-2 py-0.5 rounded-full
          ${isAvailable ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-100 text-surface-400'}
        `}>
          {status}
        </span>
      </div>
      <h4 className="text-sm font-bold text-surface-800">{name}</h4>
      <p className="text-xs text-surface-400 mt-1 mb-3">{description}</p>
      <p className="text-[10px] text-surface-300 font-mono">v{version}</p>
    </Card>
  );
}
