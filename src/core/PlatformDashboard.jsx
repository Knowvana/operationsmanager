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
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell, Card, PageHeader, EmptyState, Button, Logger, SettingsConfig, PlatformService, ProgressModal, SuccessModal, ErrorModal, ConfirmationModal } from '@shared';
import {
  LayoutDashboard, Users, Building2, Settings,
  Activity, Shield, Database, CheckCircle2,
  ScrollText, Save, HardDrive, RefreshCw, ExternalLink,
  Clock, BarChart3, AlertTriangle, Layers, Zap
} from 'lucide-react';
import DatabaseSetupWizard from './setup/DatabaseSetupWizard';
import LogsViewer from './views/LogsViewer';
import TenantManagement from './views/TenantManagement';
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

  // --- Dynamic stats from Firestore ---
  // NOTE: dbState is the single source of truth for database status.
  //   'unknown'         = haven't checked yet (initial)
  //   'not_initialized' = Firebase reachable but no platform docs exist
  //   'empty'           = platform doc exists but collections are empty
  //   'initialized'     = platform doc exists and collections have data
  // isDatabaseReady (prop) = App.jsx's check; dbState = our own deeper check.
  // We derive "is Firebase reachable" from whether dbState !== 'unknown'.
  const [dbStats, setDbStats] = useState({ adminCount: 0, tenantCount: 0, logCount: 0, configCount: 0 });
  const [dbStatsLoading, setDbStatsLoading] = useState(true); // true initially — we load on mount
  const [dbState, setDbState] = useState('unknown');

  // Derived: Firebase is reachable if we successfully queried state at least once
  const firebaseReachable = dbState !== 'unknown';
  // Derived: DB has data (initialized with documents)
  const dbInitialized = dbState === 'initialized';

  // --- Config update state ---
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [configUpdateProgress, setConfigUpdateProgress] = useState(0);
  const [showConfigSuccess, setShowConfigSuccess] = useState(false);
  const [showConfigError, setShowConfigError] = useState(false);
  const [configErrorMessage, setConfigErrorMessage] = useState('');


  // --- Database deletion state ---
  const [showWipeConfirmation, setShowWipeConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeletingDatabase, setIsDeletingDatabase] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [showDeletionSuccess, setShowDeletionSuccess] = useState(false);
  const [deletionSuccessMessage, setDeletionSuccessMessage] = useState('');
  const [showDeletionError, setShowDeletionError] = useState(false);
  const [deletionErrorMessage, setDeletionErrorMessage] = useState('');

  // --- Refresh state ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  // --- Database Config State (editable) — MUST be before handleSaveDbConfig callback ---
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

  // --- Logging Config State ---
  const [logConfig, setLogConfig] = useState(() => Logger.getConfig());
  const [logStoragePath, setLogStoragePath] = useState(
    `${databaseSchema.root_collection}/${databaseSchema.root_document}/SystemLogs`
  );
  const [logConfigSaved, setLogConfigSaved] = useState(false);

  // =========================================================================
  // Helper: Unified database state label (single source — used everywhere)
  // =========================================================================
  const getDbStateLabel = (state) => {
    switch (state) {
      case 'initialized':     return 'Initialized';
      case 'empty':           return 'Database Created — Empty';
      case 'not_initialized': return 'Pending Initialization';
      default:                return 'Checking…';
    }
  };

  // =========================================================================
  // loadDatabaseStats — fetches DB stats + state from Firestore.
  // Called on mount (always, with progress), on isDatabaseReady change,
  // and on manual Refresh. Shows a ProgressModal with minimum 1.5s display.
  // =========================================================================
  const loadDatabaseStats = useCallback(async (showProgress = true) => {
    const startTime = Date.now();
    if (showProgress) {
      setIsRefreshing(true);
      setRefreshProgress(10);
    }
    setDbStatsLoading(true);
    try {
      if (showProgress) setRefreshProgress(30);
      const [stats, state] = await Promise.all([
        PlatformService.getDatabaseStats(),
        PlatformService.getDatabaseState(),
      ]);
      if (showProgress) setRefreshProgress(80);
      console.log('[PlatformDashboard] Stats loaded:', stats, 'state:', state);
      setDbStats(stats);
      setDbState(state);
      if (showProgress) setRefreshProgress(100);
      Logger.info('Overview', 'Database stats loaded', { ...stats, state });
    } catch (err) {
      console.error('[PlatformDashboard] Error loading stats:', err);
      Logger.error('Overview', 'Failed to load database stats', { error: err.message });
    } finally {
      setDbStatsLoading(false);
      if (showProgress) {
        // Keep modal visible for at least 1.5s so user always sees feedback
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(1500 - elapsed, 300);
        setTimeout(() => {
          setIsRefreshing(false);
          setRefreshProgress(0);
        }, remaining);
      }
    }
  }, []);

  // Always load stats on mount with progress modal
  useEffect(() => {
    loadDatabaseStats(true);
  }, [loadDatabaseStats]);

  // Reload stats when isDatabaseReady flips to true (after setup wizard completes)
  useEffect(() => {
    if (isDatabaseReady) {
      loadDatabaseStats(false);
    }
  }, [isDatabaseReady, loadDatabaseStats]);

  // --- Config Update Handler ---
  const handleSaveDbConfig = useCallback(async () => {
    setIsUpdatingConfig(true);
    setConfigUpdateProgress(0);
    setShowConfigError(false);
    try {
      // Simulate progress
      setConfigUpdateProgress(30);
      
      console.log('[PlatformDashboard] Saving database config:', {
        rootCollection: dbConfig.rootCollection,
        rootDocument: dbConfig.rootDocument,
        firestoreUrl: dbConfig.firestoreUrl,
        collections: dbConfig.collections,
      });
      
      // Update database config in Firestore
      await PlatformService.updateSystemConfig('database', {
        rootCollection: dbConfig.rootCollection,
        rootDocument: dbConfig.rootDocument,
        firestoreUrl: dbConfig.firestoreUrl,
        collections: dbConfig.collections,
      });
      
      setConfigUpdateProgress(70);
      
      console.log('[PlatformDashboard] Database config saved, updating logging config...');
      
      // Update logging config if needed
      await PlatformService.updateSystemConfig('logging', {
        minLevel: Logger.getConfig().minLevel,
        maxBufferSize: Logger.getConfig().maxBufferSize,
        consoleOutput: Logger.getConfig().consoleOutput,
      });
      
      setConfigUpdateProgress(100);
      setIsUpdatingConfig(false);
      setShowConfigSuccess(true);
      Logger.info('Settings', 'Configuration updated successfully', { dbConfig });
      console.log('[PlatformDashboard] Configuration saved successfully');
    } catch (err) {
      setIsUpdatingConfig(false);
      const errorMsg = err?.message || 'An unknown error occurred while updating configuration';
      setConfigErrorMessage(errorMsg);
      setShowConfigError(true);
      Logger.error('Settings', 'Failed to update configuration', { error: errorMsg });
      console.error('[PlatformDashboard] Error saving config:', err);
    }
  }, [dbConfig]);

  const handleDatabaseSetupComplete = () => {
    setIsSetupWizardOpen(false);
    onDatabaseReady?.();
    Logger.info('Platform', 'Database setup completed');
  };

  // --- Database Deletion Handlers ---
  const handleWipeDatabase = useCallback(async () => {
    setShowWipeConfirmation(false);
    setIsDeletingDatabase(true);
    setDeletionProgress(0);
    setShowDeletionError(false);
    try {
      console.log('[PlatformDashboard] Starting database wipe...');
      setDeletionProgress(25);
      
      const result = await PlatformService.wipeAllCollections();
      
      setDeletionProgress(100);
      setIsDeletingDatabase(false);
      setDeletionSuccessMessage(`Successfully wiped ${result.deletedCount} documents from database`);
      setShowDeletionSuccess(true);
      Logger.info('Settings', 'Database wiped successfully', { deletedCount: result.deletedCount });
      console.log('[PlatformDashboard] Database wipe completed:', result);
      
      // Reload stats after deletion
      setTimeout(() => loadDatabaseStats(), 1000);
    } catch (err) {
      setIsDeletingDatabase(false);
      const errorMsg = err?.message || 'Failed to wipe database';
      setDeletionErrorMessage(errorMsg);
      setShowDeletionError(true);
      Logger.error('Settings', 'Failed to wipe database', { error: errorMsg });
      console.error('[PlatformDashboard] Error wiping database:', err);
    }
  }, [loadDatabaseStats]);

  const handleDeleteDatabase = useCallback(async () => {
    setShowDeleteConfirmation(false);
    setIsDeletingDatabase(true);
    setDeletionProgress(0);
    setShowDeletionError(false);
    try {
      console.log('[PlatformDashboard] Starting complete database deletion...');
      setDeletionProgress(25);
      
      const result = await PlatformService.deleteAllCollections();
      
      setDeletionProgress(100);
      setIsDeletingDatabase(false);
      setDeletionSuccessMessage(`Successfully deleted ${result.deletedCount} documents. Database is now empty.`);
      setShowDeletionSuccess(true);
      Logger.info('Settings', 'Database deleted successfully', { deletedCount: result.deletedCount });
      console.log('[PlatformDashboard] Database deletion completed:', result);
      
      // Reload stats after deletion
      setTimeout(() => loadDatabaseStats(), 1000);
    } catch (err) {
      setIsDeletingDatabase(false);
      const errorMsg = err?.message || 'Failed to delete database';
      setDeletionErrorMessage(errorMsg);
      setShowDeletionError(true);
      Logger.error('Settings', 'Failed to delete database', { error: errorMsg });
      console.error('[PlatformDashboard] Error deleting database:', err);
    }
  }, [loadDatabaseStats]);

  const handleSaveLogConfig = () => {
    Logger.updateConfig(logConfig);
    Logger.info('Settings', 'Logging configuration saved', { ...logConfig, storagePath: logStoragePath });
    setLogConfigSaved(true);
    setTimeout(() => setLogConfigSaved(false), 2000);
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
        return <TenantManagement isDatabaseReady={isDatabaseReady} />;

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

  // Computed stats for overview (in-memory logs)
  const logStats = useMemo(() => {
    const logs = Logger.getSystemLogs();
    const apiLogs = Logger.getApiLogs();
    const errors = logs.filter((l) => l.level === 'error').length;
    const warnings = logs.filter((l) => l.level === 'warn').length;
    const last5 = logs.slice(0, 5);
    return { total: logs.length, apiTotal: apiLogs.length, errors, warnings, last5 };
  }, [activeView]);

  const schemaInfo = useMemo(() => PlatformService.getSchemaInfo(), []);

  // Dynamic checklist — derived from real-time state.
  // "Database Created" = Firebase is reachable (Firestore project exists and responds).
  // "Database Initialized" = system_admins has at least 1 doc (isDatabaseInitialized check).
  const checklist = useMemo(() => [
    { label: 'Firebase Connected', done: firebaseReachable },
    { label: 'Database Created', done: firebaseReachable },
    { label: 'Database Initialized', done: dbInitialized },
    { label: 'Admin Account Created', done: dbStats.adminCount > 0 },
    { label: 'Logging Active', done: dbStats.logCount > 0 || dbStats.configCount > 0 },
    { label: 'First Tenant Created', done: dbStats.tenantCount > 0 },
    { label: 'Users Onboarded', done: false },
    { label: 'Module Subscriptions', done: false },
  ], [firebaseReachable, dbInitialized, dbStats, dbState]);

  const checklistDone = checklist.filter((c) => c.done).length;

  function renderOverview() {
    return (
      <div className="space-y-0 animate-fade-in">
        <PageHeader
          title="Platform Overview"
          subtitle={`Welcome back, ${user?.displayName || 'Administrator'}`}
          icon={LayoutDashboard}
        />

        {/* ─── Row 1: Key Metrics ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <StatCard
            icon={<Zap size={20} className="text-emerald-500" />}
            label="System Health"
            value={firebaseReachable ? 'Operational' : (dbStatsLoading ? 'Checking…' : 'Degraded')}
            gradient={firebaseReachable ? 'from-emerald-50 to-teal-50' : 'from-amber-50 to-orange-50'}
            detail={firebaseReachable ? (dbInitialized ? 'All services running' : 'Firebase connected · DB needs setup') : (dbStatsLoading ? 'Connecting to Firebase…' : 'Cannot reach Firebase')}
            glow={firebaseReachable ? 'shadow-emerald-100/60' : 'shadow-amber-100/60'}
            borderGradient={firebaseReachable ? 'from-emerald-300 to-teal-300' : 'from-amber-300 to-orange-300'}
          />
          <StatCard
            icon={<Database size={20} className="text-brand-500" />}
            label="Database"
            value={dbInitialized ? 'Ready' : (firebaseReachable ? 'Not Ready' : 'Checking…')}
            gradient={dbInitialized ? 'from-brand-50 to-blue-50' : 'from-amber-50 to-orange-50'}
            detail={getDbStateLabel(dbState)}
            glow={dbInitialized ? 'shadow-brand-100/60' : 'shadow-amber-100/60'}
            borderGradient={dbInitialized ? 'from-brand-300 to-blue-300' : 'from-amber-300 to-orange-300'}
            actionButton={
              dbState === 'empty' ? (
                <Button variant="primary" size="xs" onClick={() => setIsSetupWizardOpen(true)}>
                  Import Data
                </Button>
              ) : dbState === 'not_initialized' ? (
                <Button variant="primary" size="xs" onClick={() => setIsSetupWizardOpen(true)}>
                  Initialize
                </Button>
              ) : null
            }
          />
          <StatCard
            icon={<Building2 size={20} className="text-violet-500" />}
            label="Tenants"
            value={dbStatsLoading ? '...' : String(dbStats.tenantCount)}
            gradient="from-violet-50 to-purple-50"
            detail={dbStats.tenantCount === 0 ? 'Create your first tenant' : `${dbStats.tenantCount} active`}
            glow="shadow-violet-100/60"
            borderGradient="from-violet-300 to-purple-300"
          />
          <StatCard
            icon={<ScrollText size={20} className="text-amber-500" />}
            label="Log Entries"
            value={dbStatsLoading ? '...' : String(dbStats.logCount)}
            gradient="from-amber-50 to-orange-50"
            detail={dbStats.logCount === 0 ? 'No logs persisted yet' : `${dbStats.logCount} persisted to database`}
            glow="shadow-amber-100/60"
            borderGradient="from-amber-300 to-orange-300"
          />
        </div>

        {/* ─── Gradient Separator ─── */}
        <div className="py-6">
          <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
        </div>

        {/* ─── Row 2: DB Objects + Config Status + Logging ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Database Objects (dynamic) */}
          <GlowCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
                <HardDrive size={15} className="text-brand-500" />
                Database Objects
              </h3>
              <div className="flex items-center gap-2">
                {dbStatsLoading && <RefreshCw size={12} className="text-surface-300 animate-spin" />}
                {firebaseReachable ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">CONNECTED</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">CHECKING</span>
                )}
              </div>
            </div>
            <div className="space-y-2.5">
              <MiniStat label="Root Collection" value={schemaInfo.rootCollection} mono />
              <MiniStat label="Root Document" value={schemaInfo.rootDocument} mono />
              <MiniStat label="Collections" value={String(schemaInfo.collectionCount)} />
              <MiniStat label="Total Fields" value={String(schemaInfo.totalFields)} />
              <MiniStat label="Module Collections" value={String(schemaInfo.moduleCollectionCount)} />
              <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent my-1" />
              <MiniStat label="Admins (DB)" value={dbStatsLoading ? '...' : String(dbStats.adminCount)} />
              <MiniStat label="Tenants (DB)" value={dbStatsLoading ? '...' : String(dbStats.tenantCount)} />
              <MiniStat label="Logs (DB)" value={dbStatsLoading ? '...' : String(dbStats.logCount)} />
              <MiniStat label="Config Docs (DB)" value={dbStatsLoading ? '...' : String(dbStats.configCount)} />
              <MiniStat label="Provider" value="Firebase Firestore" />
              <MiniStat label="Project ID" value={firebaseConfig.projectId || '—'} mono />
            </div>
            {!dbInitialized && (
              <Button variant="primary" size="sm" className="mt-4" icon={<Database size={14} />} onClick={() => setIsSetupWizardOpen(true)}>
                {dbState === 'empty' ? 'Import Default Data' : 'Run Setup Wizard'}
              </Button>
            )}
          </GlowCard>

          {/* Configuration Status (dynamic) */}
          <GlowCard>
            <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
              <Shield size={15} className="text-brand-500" />
              Configuration Status
            </h3>
            <div className="space-y-3">
              {checklist.map((item, i) => (
                <StatusRow key={i} label={item.label} done={item.done} />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-surface-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-400">Setup Progress</span>
                <span className="text-xs font-bold text-brand-600">{checklistDone}/{checklist.length}</span>
              </div>
              <div className="w-full h-2 bg-surface-100 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                />
              </div>
            </div>
          </GlowCard>

          {/* Logging Overview (Database + In-Memory) */}
          <GlowCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
                <BarChart3 size={15} className="text-brand-500" />
                Logging Summary
              </h3>
            </div>
            
            {/* Database Logs */}
            <div className="mb-4">
              <p className="text-[10px] font-bold text-surface-600 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-500" />
                Database Logs
              </p>
              <div className="space-y-2">
                <MiniStat label="Persisted Logs" value={dbStatsLoading ? '...' : String(dbStats.logCount)} />
                <MiniStat label="Status" value={dbStats.logCount > 0 ? 'Active' : 'No logs yet'} valueColor={dbStats.logCount > 0 ? 'text-emerald-600' : 'text-surface-400'} />
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent my-3" />

            {/* In-Memory Logs */}
            <div>
              <p className="text-[10px] font-bold text-surface-600 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                In-Memory Logs
              </p>
              <div className="space-y-2">
                <MiniStat label="Total Logs" value={String(logStats.total)} />
                <MiniStat label="API Calls" value={String(logStats.apiTotal)} />
                <MiniStat label="Errors" value={String(logStats.errors)} valueColor={logStats.errors > 0 ? 'text-rose-600' : undefined} />
                <MiniStat label="Warnings" value={String(logStats.warnings)} valueColor={logStats.warnings > 0 ? 'text-amber-600' : undefined} />
                <MiniStat label="Buffer" value={`${Logger.getFlushBufferSize()} pending`} />
              </div>
            </div>

            <Button variant="primary" size="sm" className="w-full mt-4" icon={<ScrollText size={14} />} onClick={() => setActiveView('logs')}>
              View All Logs
            </Button>
          </GlowCard>
        </div>

        {/* ─── Gradient Separator ─── */}
        <div className="py-6">
          <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
        </div>

        {/* ─── Row 3: Recent Activity + Platform Info ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <GlowCard>
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
          </GlowCard>

          {/* Platform Information */}
          <GlowCard>
            <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
              <Layers size={15} className="text-brand-500" />
              Platform Information
            </h3>
            <div className="space-y-2.5">
              <MiniStat label="Platform" value={appConfig.appName || appName} />
              <MiniStat label="Version" value={appConfig.appVersion || '1.0.0'} mono />
              <MiniStat label="Environment" value="Development" />
              <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent my-1" />
              <MiniStat label="Framework" value="React 18 + Vite 5" />
              <MiniStat label="UI Library" value="Tailwind CSS 3" />
              <MiniStat label="Backend" value="Firebase 10" />
              <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent my-1" />
              <MiniStat label="Total Modules" value={String(appConfig.availableModules?.length || 0)} />
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
          </GlowCard>
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
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">Connection Status</h4>
            <Button
              variant="primary"
              size="xxs"
              icon={<RefreshCw size={11} />}
              onClick={() => loadDatabaseStats(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
          <div className="space-y-2.5">
            {/* Row: Firebase Connection (reachable or not) */}
            <SettingsRow
              label="Firebase Connection"
              value={firebaseReachable ? 'Connected' : (dbStatsLoading ? 'Checking…' : 'Unreachable')}
              valueColor={firebaseReachable ? 'text-emerald-600' : 'text-amber-600'}
            />
            {/* Row: Database State (single action button based on state) */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-surface-500">Database State</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${
                  dbState === 'initialized' ? 'text-emerald-600' :
                  dbState === 'empty' ? 'text-amber-600' :
                  'text-surface-500'
                }`}>
                  {getDbStateLabel(dbState)}
                </span>
                {(dbState === 'empty' || dbState === 'not_initialized') && (
                  <Button
                    variant="primary"
                    size="xxs"
                    onClick={() => setIsSetupWizardOpen(true)}
                  >
                    {dbState === 'empty' ? 'Import' : 'Initialize'}
                  </Button>
                )}
              </div>
            </div>
            <SettingsRow label="Provider" value="Firebase Firestore" />
            <SettingsRow label="Project ID" value={firebaseConfig.projectId || '—'} mono />
            <SettingsRow label="Auth Domain" value={firebaseConfig.authDomain || '—'} mono />
          </div>
        </Card>

        {/* Database Configuration */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Database Configuration</h4>
          <div className="space-y-3">
            <SettingsRow
              label="Root Collection"
              value={dbConfig.rootCollection}
              mono
            />
            <SettingsRow
              label="Root Document"
              value={dbConfig.rootDocument}
              mono
            />
            <SettingsRow
              label="Document Path"
              value={`${dbConfig.rootCollection}/${dbConfig.rootDocument}`}
              mono
            />
            <EditableField
              label="Firestore Console URL"
              value={dbConfig.firestoreUrl}
              onChange={(v) => setDbConfig((p) => ({ ...p, firestoreUrl: v }))}
            />
          </div>
        </Card>

        {/* Database Policies */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Database Policies</h4>
          <div className="space-y-3">
            <EditableField
              label="Max Documents Per Collection"
              value={dbConfig.maxDocsPerCollection || '10000'}
              onChange={(v) => setDbConfig((p) => ({ ...p, maxDocsPerCollection: v }))}
            />
            <EditableField
              label="Data Retention (days)"
              value={dbConfig.dataRetentionDays || '90'}
              onChange={(v) => setDbConfig((p) => ({ ...p, dataRetentionDays: v }))}
            />
            <EditableField
              label="Backup Frequency (hours)"
              value={dbConfig.backupFrequencyHours || '24'}
              onChange={(v) => setDbConfig((p) => ({ ...p, backupFrequencyHours: v }))}
            />
            <ToggleRow
              label="Enable Automatic Backups"
              value={dbConfig.autoBackupEnabled !== false}
              onChange={(v) => setDbConfig((p) => ({ ...p, autoBackupEnabled: v }))}
            />
          </div>
        </Card>

        {/* Collections (Read-Only) */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Collections (Read-Only)</h4>
          <p className="text-xs text-surface-500 mb-3">These are your actual Firestore collection names. They cannot be edited here.</p>
          <div className="space-y-3">
            {dbConfig.collections.map((col) => (
              <div key={col.key} className="flex items-center gap-3 py-2 border-b border-surface-50 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-surface-400 bg-surface-50 px-1.5 py-0.5 rounded">{col.key}</span>
                    <span className="text-[10px] text-surface-300">{col.fieldCount} fields</span>
                  </div>
                  <div className="px-2.5 py-1.5 text-sm border border-surface-200 rounded-lg bg-surface-50 font-mono text-surface-600">
                    {col.path}
                  </div>
                  <p className="text-[10px] text-surface-400 mt-1">{col.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>


        {/* Danger Zone — Database Operations */}
        <Card variant="flat" className="p-4 border-rose-200 bg-rose-50/30 mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-3">⚠️ Danger Zone</h4>
          <p className="text-xs text-surface-600 mb-4">These actions cannot be undone. Use with caution.</p>
          <div className="space-y-3">
            {dbState === 'empty' && (
              <div>
                <h5 className="text-xs font-semibold text-surface-700 mb-2">Reinitialize Database</h5>
                <p className="text-xs text-surface-500 mb-2">Restore default platform data (admins, config, etc.) to an empty database.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw size={14} />}
                  onClick={() => setIsSetupWizardOpen(true)}
                >
                  Reinitialize with Defaults
                </Button>
              </div>
            )}
            <div>
              <h5 className="text-xs font-semibold text-surface-700 mb-2">Wipe Database</h5>
              <p className="text-xs text-surface-500 mb-2">Delete all documents from all collections, but keep the collection structure intact.</p>
              <Button
                variant="danger"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={() => setShowWipeConfirmation(true)}
                disabled={isDeletingDatabase}
              >
                Wipe All Data
              </Button>
            </div>
            <div className="border-t border-surface-200 pt-3">
              <h5 className="text-xs font-semibold text-surface-700 mb-2">Delete Database</h5>
              <p className="text-xs text-surface-500 mb-2">Permanently delete all documents from all collections. Complete database reset.</p>
              <Button
                variant="danger"
                size="sm"
                icon={<AlertTriangle size={14} />}
                onClick={() => setShowDeleteConfirmation(true)}
                disabled={isDeletingDatabase}
              >
                Delete All Data
              </Button>
            </div>
          </div>
        </Card>

        {/* Final Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-surface-200">
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={handleSaveDbConfig}
            disabled={isUpdatingConfig}
          >
            {isUpdatingConfig ? 'Saving...' : 'Save Configuration'}
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
      onSystemAdmin={() => setActiveView('overview')}
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

      {/* Config Update Progress Modal */}
      <ProgressModal
        isOpen={isUpdatingConfig}
        title="Updating Configuration"
        message="Saving changes to database..."
        progress={configUpdateProgress}
      />

      {/* Config Update Success Modal */}
      <SuccessModal
        isOpen={showConfigSuccess}
        title="Configuration Updated"
        message="Your changes have been saved successfully to the database."
        onClose={() => setShowConfigSuccess(false)}
      />

      {/* Config Update Error Modal */}
      <ErrorModal
        isOpen={showConfigError}
        title="Configuration Failed"
        message={configErrorMessage}
        onClose={() => setShowConfigError(false)}
      />

      {/* Wipe Database Confirmation Modal */}
      <ConfirmationModal
        isOpen={showWipeConfirmation}
        title="Wipe Database"
        message="This will delete all documents from all collections but keep the collection structure intact. This action cannot be undone."
        confirmText="Wipe All Data"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleWipeDatabase}
        onCancel={() => setShowWipeConfirmation(false)}
      />

      {/* Delete Database Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Delete All Database Data"
        message="This will permanently delete all documents from all collections. Your database will be completely empty. This action cannot be undone."
        confirmText="Delete All Data"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleDeleteDatabase}
        onCancel={() => setShowDeleteConfirmation(false)}
      />

      {/* Database Deletion Progress Modal */}
      <ProgressModal
        isOpen={isDeletingDatabase}
        title="Deleting Database"
        message="Removing all documents from database..."
        progress={deletionProgress}
      />

      {/* Database Deletion Success Modal */}
      <SuccessModal
        isOpen={showDeletionSuccess}
        title="Database Cleared"
        message={deletionSuccessMessage}
        onClose={() => setShowDeletionSuccess(false)}
      />

      {/* Database Deletion Error Modal */}
      <ErrorModal
        isOpen={showDeletionError}
        title="Deletion Failed"
        message={deletionErrorMessage}
        onClose={() => setShowDeletionError(false)}
      />

      {/* Refresh Status Progress Modal */}
      <ProgressModal
        isOpen={isRefreshing}
        title="Refreshing Status"
        message="Checking database connection and state..."
        progress={refreshProgress}
      />
    </AppShell>
  );
}

// --- Local sub-components (only used in this file) ---

function StatCard({ icon, label, value, gradient, detail, glow = '', borderGradient = '', actionButton = null }) {
  return (
    <div className={`relative rounded-xl overflow-hidden shadow-md ${glow}`}>
      {/* Gradient left border accent */}
      {borderGradient && (
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${borderGradient}`} />
      )}
      <div className={`p-4 pl-5 bg-gradient-to-br ${gradient} border border-surface-200/60 rounded-xl flex flex-col h-full`}>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-white/80 shadow-sm">{icon}</div>
        </div>
        <p className="text-xl font-extrabold text-surface-800 mb-1">{value}</p>
        <p className="text-xs font-semibold text-surface-600">{label}</p>
        {detail && <p className="text-[10px] text-surface-500 mt-1 flex-grow">{detail}</p>}
        {actionButton && <div className="mt-auto pt-2">{actionButton}</div>}
      </div>
    </div>
  );
}

function GlowCard({ children }) {
  return (
    <div className="relative rounded-xl overflow-hidden shadow-md shadow-surface-200/40 hover:shadow-lg hover:shadow-brand-100/30 transition-shadow duration-300">
      {/* Gradient left border */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-400 via-teal-400 to-emerald-400" />
      <div className="bg-white border border-surface-200/60 rounded-xl p-6 pl-7">
        {children}
      </div>
    </div>
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
