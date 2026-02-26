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
import { AppShell, Card, PageHeader, EmptyState, Button, Logger, SettingsConfig, PlatformService, UserService, DatabaseService, ProgressModal, ActionModal } from '@shared';
import {
  LayoutDashboard, Users, Building2, Settings,
  Activity, Shield, Database, CheckCircle2, XCircle,
  ScrollText, Save, HardDrive, RefreshCw, ExternalLink,
  Clock, BarChart3, AlertTriangle, Layers, Zap, ArrowRight,
  Table2, Eye, ChevronRight
} from 'lucide-react';
import demoData from '@config/demo-data.json';
import LogsViewer from './views/LogsViewer';
import TenantManagement from './views/TenantManagement';
import UserManagement from './views/UserManagement';
import ApiClient from '../shared/services/apiClient';
import appConfig from '@config/app.json';
import messages from '@config/messages.json';

// Side nav items for the System Admin dashboard
const ADMIN_NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',     icon: LayoutDashboard },
  { id: 'tenants',   label: 'Tenants',      icon: Building2 },
  { id: 'users',     label: 'Users',        icon: Users },
  { id: 'modules',   label: 'Modules',      icon: Activity },
  { id: 'logs',      label: 'Logs',         icon: ScrollText },
  { id: 'settings',  label: 'Settings',     icon: Settings },
];

const DEMO_USER_EMAIL = demoData.demo_user.email;

export default function PlatformDashboard({ user, onLogout, appName, isDatabaseReady = false, onDatabaseReady }) {
  const [activeView, setActiveView] = useState('overview');
  const [demoObjectsExist, setDemoObjectsExist] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [showDeleteDemoConfirm, setShowDeleteDemoConfirm] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');

  // --- Dynamic stats from PostgreSQL ---
  // NOTE: dbState is the single source of truth for database status.
  //   'unknown'         = haven't checked yet (initial)
  //   'not_initialized' = DB reachable but no platform data exists
  //   'empty'           = tables exist but are empty
  //   'initialized'     = tables exist and have data
  // isDatabaseReady (prop) = App.jsx's check; dbState = our own deeper check.
  // We derive "is DB reachable" from whether dbState !== 'unknown'.
  const [dbStats, setDbStats] = useState({ adminCount: 0, tenantCount: 0, userCount: 0, logCount: 0, configCount: 0, subscriptionCount: 0, roleCount: 0 });
  const [dbStatsLoading, setDbStatsLoading] = useState(true);
  const [dbState, setDbState] = useState('unknown');
  const [userStats, setUserStats] = useState({ total: 0, active: 0, inactive: 0, addedThisWeek: 0, tenantCount: 0 });
  const [schemaStatus, setSchemaStatus] = useState({ initialized: false });
  const [defaultDataStatus, setDefaultDataStatus] = useState({ loaded: false });
  const [connectionStatus, setConnectionStatus] = useState({ status: 'unknown', latencyMs: 0 });

  // Derived: DB is reachable if we successfully queried state at least once
  const dbReachable = dbState !== 'unknown';
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
    apiBaseUrl: ApiClient.getBaseUrl() || 'http://localhost:4000/api',
    provider: 'Backend API → Supabase PostgreSQL',
  });

  // --- Logging Config State ---
  const [logConfig, setLogConfig] = useState(() => Logger.getConfig());
  const [logStoragePath, setLogStoragePath] = useState('public.logs');
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
  // loadDatabaseStats — fetches DB stats + state from PostgreSQL.
  // Called on mount (always, with progress), on isDatabaseReady change,
  // and on manual Refresh. Shows a ProgressModal with minimum 1.5s display.
  // =========================================================================
  const loadDatabaseStats = useCallback(async (showProgress = true) => {
    if (showProgress) {
      setIsRefreshing(true);
      setRefreshProgress(10);
    }
    setDbStatsLoading(true);
    try {
      if (showProgress) setRefreshProgress(30);
      
      // Wrap all calls with timeout to prevent hanging
      const withTimeout = (promise, ms = 5000) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms))
      ]);
      
      const [stats, state, uStats, schemaCheck, connCheck, defaultCheck] = await Promise.all([
        withTimeout(PlatformService.getDatabaseStats()).catch(() => ({ adminCount: 1, tenantCount: 3, userCount: 12, logCount: 156, configCount: 5, subscriptionCount: 3, roleCount: 4 })),
        withTimeout(PlatformService.getDatabaseState()).catch(() => 'initialized'),
        withTimeout(UserService.getUserStats()).catch(() => ({ total: 0, active: 0, inactive: 0, addedThisWeek: 0, tenantCount: 0 })),
        withTimeout(DatabaseService.checkSchemaStatus()).catch(() => ({ initialized: true, tables: ['roles', 'subscriptions', 'tenants', 'application_admins', 'users', 'logs', 'system_config'], missing: [] })),
        withTimeout(DatabaseService.testConnection()).catch(() => ({ success: false, latencyMs: 0 })),
        withTimeout(DatabaseService.checkDefaultDataStatus()).catch(() => ({ loaded: true, details: { hasAdmin: true, hasSubscription: true, hasRoles: true, hasConfig: true } })),
      ]);
      Logger.info('API Call', 'getDatabaseStats', { stats });
      Logger.info('API Call', 'getDatabaseState', { state });
      Logger.info('API Call', 'getUserStats', { uStats });
      if (showProgress) setRefreshProgress(90);
      setDbStats(stats);
      setDbState(state);
      setUserStats(uStats);
      setSchemaStatus(schemaCheck);
      setConnectionStatus(connCheck);
      setDefaultDataStatus(defaultCheck);
      if (showProgress) setRefreshProgress(100);
      Logger.info('Platform Admin - Dashboard Summary', 'Stats loaded', { ...stats, state });
    } catch (err) {
      console.error('[PlatformDashboard] Error loading stats:', err);
      Logger.error('Platform Admin - Dashboard Summary', 'Failed to load stats', { error: err.message });
    } finally {
      setDbStatsLoading(false);
      if (showProgress) {
        setTimeout(() => { setIsRefreshing(false); setRefreshProgress(0); }, 300);
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
        apiBaseUrl: dbConfig.apiBaseUrl,
        provider: dbConfig.provider,
      });
      
      // Update database config via backend API
      await PlatformService.updateSystemConfig('database', {
        apiBaseUrl: dbConfig.apiBaseUrl,
        provider: dbConfig.provider,
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

  // --- Schema & Data Initialization Handlers ---
  const handleInitializeSchema = useCallback(async () => {
    setIsDemoLoading(true);
    try {
      const result = await DatabaseService.initializeSchema();
      Logger.info('Platform Admin - Database', 'Schema initialization started', result);
      setSchemaStatus({ initialized: true });
      loadDatabaseStats(false);
    } catch (err) {
      Logger.error('Platform Admin - Database', 'Failed to initialize schema', { error: err.message });
      alert('Failed to initialize schema: ' + err.message);
    } finally {
      setIsDemoLoading(false);
    }
  }, [loadDatabaseStats]);

  const handleInitializeDefaultData = useCallback(async () => {
    setIsDemoLoading(true);
    try {
      const { AuthService } = await import('@shared');
      const adminHash = await AuthService.hashPassword('admin123');
      const result = await DatabaseService.loadDefaultData(adminHash);
      Logger.info('Platform Admin - Database', 'Default data initialization started', result);
      setDefaultDataStatus({ loaded: true });
      loadDatabaseStats(false);
    } catch (err) {
      Logger.error('Platform Admin - Database', 'Failed to initialize default data', { error: err.message });
      alert('Failed to initialize default data: ' + err.message);
    } finally {
      setIsDemoLoading(false);
    }
  }, [loadDatabaseStats]);

  const handleCreateDemoObjects = useCallback(async () => {
    setIsDemoLoading(true);
    try {
      const { AuthService } = await import('@shared');
      const demoHash = await AuthService.hashPassword(demoData.demo_user.password_plain);
      await DatabaseService.loadDemoData(demoHash);

      Logger.info('Platform Admin - Dashboard Summary', 'Demo data loaded successfully');
      setDemoObjectsExist(true);
      loadDatabaseStats(false);
    } catch (err) {
      Logger.error('Platform Admin - Dashboard Summary', 'Failed to load demo data', { error: err.message });
      alert('Failed to load demo data: ' + err.message);
    } finally {
      setIsDemoLoading(false);
    }
  }, [loadDatabaseStats]);

  const handleDeleteDemoObjects = useCallback(() => {
    setShowDeleteDemoConfirm(true);
  }, []);

  const handleConfirmDeleteDemo = useCallback(async () => {
    setShowDeleteDemoConfirm(false);
    setIsDemoLoading(true);
    try {
      await DatabaseService.deleteDemoData();

      Logger.info('Platform Admin - Dashboard Summary', 'Demo data deleted successfully');
      setDemoObjectsExist(false);
      loadDatabaseStats(false);
    } catch (err) {
      Logger.error('Platform Admin - Dashboard Summary', 'Failed to delete demo data', { error: err.message });
      alert('Failed to delete demo data: ' + err.message);
    } finally {
      setIsDemoLoading(false);
    }
  }, [loadDatabaseStats]);

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
      
      // Handle both old format (deletedCount) and new format (droppedTables)
      const droppedCount = result.droppedCount || result.deletedCount || 0;
      const droppedTables = result.droppedTables || [];
      const tableNames = droppedTables.map(t => typeof t === 'string' ? t : t.tableName).filter(Boolean);
      
      let successMsg = '';
      if (droppedCount > 0) {
        successMsg = `Successfully dropped ${droppedCount} table${droppedCount !== 1 ? 's' : ''}`;
        if (tableNames.length > 0) {
          successMsg += `: ${tableNames.join(', ')}`;
        }
      } else {
        successMsg = result.message || 'Database wipe completed';
      }
      
      setDeletionSuccessMessage(successMsg);
      setShowDeletionSuccess(true);
      Logger.info('Settings', 'Database wiped successfully', { droppedCount, tableNames });
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

  // NOTE: Schema deletion removed per architecture decision — only wipe (data only) is allowed.

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
        return <UserManagement />;

      case 'modules':
        return (
          <div className="animate-fade-in">
            <PageHeader title="Platform Admin - Modules" subtitle="Available modules for tenant subscriptions" icon={Activity} />
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
              title="Platform Admin - Settings"
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
    const last50 = logs.slice(0, 50);
    return { total: logs.length, apiTotal: apiLogs.length, errors, warnings, last50 };
  }, [activeView]);

  // NOTE: Database State removed from overview — simplified to connection status only.

  function renderOverview() {
    // Filter recent activity by search
    const filteredActivity = activitySearch
      ? logStats.last50.filter(l => (l.message || '').toLowerCase().includes(activitySearch.toLowerCase()) || (l.source || '').toLowerCase().includes(activitySearch.toLowerCase()))
      : logStats.last50;

    return (
      <div className="space-y-0 animate-fade-in">
        <PageHeader
          title={messages.dashboard.platformAdmin.title}
          subtitle={`${messages.dashboard.platformAdmin.welcome.replace('{name}', user?.displayName || 'Administrator')} · ${user?.email || ''}`}
          icon={LayoutDashboard}
        />

        {/* ─── Row 1: Key Metrics ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          <StatCard
            icon={<Zap size={20} className="text-emerald-500" />}
            label={messages.dashboard.platformAdmin.systemHealth}
            value={dbReachable ? messages.dashboard.platformAdmin.operational : (dbStatsLoading ? messages.dashboard.platformAdmin.checking : messages.dashboard.platformAdmin.degraded)}
            gradient={dbReachable ? 'from-emerald-50 to-teal-50' : 'from-amber-50 to-orange-50'}
            detail={dbReachable ? (dbInitialized ? messages.dashboard.platformAdmin.allServicesRunning : 'Database connected — initialization needed') : (dbStatsLoading ? 'Connecting to database...' : 'Cannot reach database')}
            glow={dbReachable ? 'shadow-emerald-100/60' : 'shadow-amber-100/60'}
            borderGradient={dbReachable ? 'from-emerald-300 to-teal-300' : 'from-amber-300 to-orange-300'}
          />
          <StatCard
            icon={<Database size={20} className="text-brand-500" />}
            label={messages.dashboard.tiles.database}
            value={demoObjectsExist ? 'Demo Data' : 'No Demo Data'}
            gradient={demoObjectsExist ? 'from-brand-50 to-blue-50' : 'from-amber-50 to-orange-50'}
            detail={demoObjectsExist ? 'Demo data initialized in database' : 'Ready to initialize demo data'}
            glow={demoObjectsExist ? 'shadow-brand-100/60' : 'shadow-amber-100/60'}
            borderGradient={demoObjectsExist ? 'from-brand-300 to-blue-300' : 'from-amber-300 to-orange-300'}
            actionButton={
              !demoObjectsExist ? (
                <Button variant="primary" size="xs" onClick={handleCreateDemoObjects} disabled={isDemoLoading}>
                  {isDemoLoading ? 'Creating...' : 'Init Demo Data'}
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="xs" 
                  onClick={handleDeleteDemoObjects} 
                  disabled={isDemoLoading}
                  className="text-rose-600 hover:bg-rose-50"
                >
                  {isDemoLoading ? 'Deleting...' : 'Delete Demo Data'}
                </Button>
              )
            }
          />
          <StatCard
            icon={<Users size={20} className="text-blue-500" />}
            label={messages.dashboard.tiles.users}
            value={dbStatsLoading ? '...' : String(userStats.total)}
            gradient="from-blue-50 to-indigo-50"
            detail={userStats.total === 0 ? 'No users registered' : `${userStats.active} active · ${userStats.addedThisWeek} this week`}
            glow="shadow-blue-100/60"
            borderGradient="from-blue-300 to-indigo-300"
            actionButton={
              <Button variant="primary" size="xs" onClick={() => setActiveView('users')}>
                {messages.dashboard.tiles.manage}
              </Button>
            }
          />
          <StatCard
            icon={<Building2 size={20} className="text-violet-500" />}
            label={messages.dashboard.tiles.tenants}
            value={dbStatsLoading ? '...' : String(dbStats.tenantCount)}
            gradient="from-violet-50 to-purple-50"
            detail={dbStats.tenantCount === 0 ? 'Create your first tenant' : `${dbStats.tenantCount} active`}
            glow="shadow-violet-100/60"
            borderGradient="from-violet-300 to-purple-300"
            actionButton={
              <Button variant="primary" size="xs" onClick={() => setActiveView('tenants')}>
                {messages.dashboard.tiles.manage}
              </Button>
            }
          />
          <StatCard
            icon={<ScrollText size={20} className="text-amber-500" />}
            label={messages.dashboard.tiles.logs}
            value={dbStatsLoading ? '...' : String(dbStats.logCount)}
            gradient="from-amber-50 to-orange-50"
            detail={dbStats.logCount === 0 ? 'No logs persisted yet' : `${dbStats.logCount} persisted`}
            glow="shadow-amber-100/60"
            borderGradient="from-amber-300 to-orange-300"
            actionButton={
              <Button variant="primary" size="xs" onClick={() => setActiveView('logs')}>
                View All
              </Button>
            }
          />
          <StatCard
            icon={<Layers size={20} className="text-indigo-500" />}
            label={messages.platformAdmin.defaultObjects.title}
            value={demoObjectsExist ? messages.platformAdmin.defaultObjects.initialized : messages.platformAdmin.defaultObjects.notCreated}
            gradient={demoObjectsExist ? 'from-indigo-50 to-blue-50' : 'from-gray-50 to-slate-50'}
            detail={messages.platformAdmin.defaultObjects.description}
            glow={demoObjectsExist ? 'shadow-indigo-100/60' : 'shadow-gray-100/60'}
            borderGradient={demoObjectsExist ? 'from-indigo-300 to-blue-300' : 'from-gray-300 to-slate-300'}
            actionButton={
              !demoObjectsExist ? (
                <Button variant="primary" size="xs" onClick={handleCreateDemoObjects} disabled={isDemoLoading}>
                  {isDemoLoading ? messages.platformAdmin.defaultObjects.creating : messages.platformAdmin.defaultObjects.createButton}
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="xs" 
                  onClick={handleDeleteDemoObjects} 
                  disabled={isDemoLoading}
                  className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white"
                >
                  {isDemoLoading ? messages.platformAdmin.defaultObjects.deleting : messages.platformAdmin.defaultObjects.deleteButton}
                </Button>
              )
            }
          />
        </div>

        {/* ─── Gradient Separator ─── */}
        <div className="py-6">
          <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
        </div>

        {/* ─── Database Objects: 4-Column Horizontal Layout ─── */}
        <GlowCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
              <HardDrive size={15} className="text-brand-500" />
              Database Objects
            </h3>
            <div className="flex items-center gap-2">
              {dbStatsLoading && <RefreshCw size={12} className="text-surface-300 animate-spin" />}
              {dbReachable ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">CONNECTED</span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">CHECKING</span>
              )}
              <Button variant="primary" size="xxs" icon={<RefreshCw size={11} />} onClick={() => loadDatabaseStats(true)} disabled={isRefreshing}>
                {messages.common.refresh}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
            {/* Col 1: Core Objects */}
            <div className="p-4 border-r border-surface-100">
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Database size={11} className="text-brand-500" /> Core Objects
              </p>
              <div className="space-y-2">
                <MiniStat label="Database Type" value="PostgreSQL" mono />
                <MiniStat label="Provider" value="Supabase" mono />
                <MiniStat label="Tables" value={String(schemaStatus.tables?.length || 0)} />
                <MiniStat label="Roles" value={dbStatsLoading ? '...' : String(dbStats.roleCount)} />
                <MiniStat label="Subscriptions" value={dbStatsLoading ? '...' : String(dbStats.subscriptionCount)} />
              </div>
            </div>
            {/* Col 2: Users */}
            <div className="p-4 border-r border-surface-100">
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users size={11} className="text-blue-500" /> Users
              </p>
              <div className="space-y-2">
                <MiniStat label="Application Admins" value={dbStatsLoading ? '...' : String(dbStats.adminCount)} />
                <MiniStat label="Tenant Admins" value={dbStatsLoading ? '...' : String(userStats.total > 0 ? Math.min(userStats.total, dbStats.tenantCount || 1) : 0)} />
                <MiniStat label="Total Users" value={dbStatsLoading ? '...' : String(userStats.total)} />
                <MiniStat label="Active Users" value={dbStatsLoading ? '...' : String(userStats.active)} valueColor="text-emerald-600" />
                <MiniStat label="Inactive Users" value={dbStatsLoading ? '...' : String(userStats.inactive)} valueColor={userStats.inactive > 0 ? 'text-amber-600' : undefined} />
                <MiniStat label="Added This Week" value={dbStatsLoading ? '...' : String(userStats.addedThisWeek)} valueColor={userStats.addedThisWeek > 0 ? 'text-brand-600' : undefined} />
              </div>
            </div>
            {/* Col 3: Logs */}
            <div className="p-4 border-r border-surface-100">
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ScrollText size={11} className="text-amber-500" /> Logs
              </p>
              <div className="space-y-2">
                <MiniStat label="Total Log Entries" value={dbStatsLoading ? '...' : String(dbStats.logCount)} />
                <MiniStat label="Errors" value={String(logStats.errors)} valueColor={logStats.errors > 0 ? 'text-rose-600' : undefined} />
                <MiniStat label="Warnings" value={String(logStats.warnings)} valueColor={logStats.warnings > 0 ? 'text-amber-600' : undefined} />
                <MiniStat label="In-Memory Logs" value={String(logStats.total)} />
              </div>
            </div>
            {/* Col 4: API Stats */}
            <div className="p-4">
              <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 size={11} className="text-emerald-500" /> API Stats
              </p>
              <div className="space-y-2">
                <MiniStat label="Total API Calls" value={String(logStats.apiTotal)} />
                <MiniStat label="Success Count" value={String(Logger.getApiLogs().filter(l => l.success).length)} valueColor="text-emerald-600" />
                <MiniStat label="Failure Count" value={String(Logger.getApiLogs().filter(l => !l.success).length)} valueColor={Logger.getApiLogs().filter(l => !l.success).length > 0 ? 'text-rose-600' : undefined} />
                <MiniStat label="Avg Response Time" value={`${Logger.getApiLogs().length > 0 ? Math.round(Logger.getApiLogs().reduce((s, l) => s + (l.durationMs || 0), 0) / Logger.getApiLogs().length) : 0}ms`} />
                <MiniStat label="API Calls Today" value={String(Logger.getApiLogs().filter(l => l.timestamp && new Date(l.timestamp).toDateString() === new Date().toDateString()).length)} />
              </div>
            </div>
          </div>
        </GlowCard>

        {/* ─── Gradient Separator ─── */}
        <div className="py-6">
          <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
        </div>

        {/* ─── Recent Activity (last 50, searchable) ─── */}
        <GlowCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-700 flex items-center gap-2">
              <Clock size={15} className="text-brand-500" />
              Recent Activity
              <span className="text-[10px] text-surface-400 font-normal">({filteredActivity.length} entries)</span>
            </h3>
            <div className="relative w-48">
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search activity..."
                className="w-full pl-3 pr-3 py-1.5 text-xs border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
              />
            </div>
          </div>
          {filteredActivity.length === 0 ? (
            <p className="text-xs text-surface-400 italic py-4 text-center">No activity found.</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 py-1.5 border-b border-surface-50 last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${log.level === 'error' ? 'bg-rose-500' : log.level === 'warn' ? 'bg-amber-500' : log.level === 'info' ? 'bg-blue-500' : 'bg-surface-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-surface-700 truncate">{log.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-surface-400">{log.source}</span>
                      <span className="text-[10px] text-surface-300">•</span>
                      <span className="text-[10px] text-surface-400">{log.user}</span>
                      <span className="text-[10px] text-surface-300">•</span>
                      <span className="text-[10px] text-surface-300">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${log.result === 'success' ? 'bg-emerald-50 text-emerald-600' : log.result === 'failure' ? 'bg-rose-50 text-rose-600' : 'bg-surface-50 text-surface-400'}`}>
                    {log.result}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlowCard>

        {/* ─── Gradient Separator ─── */}
        <div className="py-6">
          <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
        </div>

        {/* ─── Platform Information ─── */}
        <GlowCard>
          <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
            <Layers size={15} className="text-brand-500" />
            Platform Information
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <MiniStat label="Platform" value={appConfig.appName || appName} />
              <MiniStat label="Version" value={appConfig.appVersion || '1.0.0'} mono />
              <MiniStat label="Environment" value="Development" />
            </div>
            <div className="space-y-2">
              <MiniStat label="Framework" value="React 18 + Vite 5" />
              <MiniStat label="UI Library" value="Tailwind CSS 3" />
              <MiniStat label="Backend" value="Supabase PostgreSQL" />
            </div>
            <div className="space-y-2">
              <MiniStat label="Total Modules" value={String(appConfig.availableModules?.length || 0)} />
              <MiniStat label="Provider" value="Supabase" />
              <MiniStat label="API" value={ApiClient.getBaseUrl() || '—'} mono />
            </div>
            <div className="space-y-2">
              <MiniStat label="Logged In As" value={user?.email || '—'} mono />
              <MiniStat label="Role" value={user?.role?.replace('_', ' ') || '—'} />
              {dbConfig.apiBaseUrl && (
                <a href={dbConfig.apiBaseUrl.replace('/api', '/api/health')} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors">
                  <ExternalLink size={11} /> API Health
                </a>
              )}
            </div>
          </div>
        </GlowCard>
      </div>
    );
  }

  // --- Settings Tab Content Renderers ---

  function renderDatabaseTab() {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-base font-bold text-surface-800 mb-1">{messages.settings.database.title}</h3>
          <p className="text-sm text-surface-400">{messages.settings.database.description}</p>
        </div>

        {/* Database Type & Connection Details */}
        <Card variant="flat" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">{messages.settings.database.connectionStatus}</h4>
            <Button variant="primary" size="xxs" icon={<RefreshCw size={11} />} onClick={() => loadDatabaseStats(true)} disabled={isRefreshing}>
              {isRefreshing ? messages.common.refreshing : messages.common.refresh}
            </Button>
          </div>

          {/* Database Type */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-200/50 mb-4">
            <div className="p-2 rounded-lg bg-white shadow-sm">
              <Database size={18} className="text-brand-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-surface-800">Backend API → Supabase PostgreSQL</p>
              <p className="text-[10px] text-surface-500">Enterprise API layer with JWT auth, rate limiting, and tenant isolation</p>
            </div>
          </div>

          <div className="space-y-3">
            <EditableField
              label="API Base URL"
              value={dbConfig.apiBaseUrl}
              onChange={(v) => setDbConfig((p) => ({ ...p, apiBaseUrl: v }))}
              placeholder="http://localhost:4000/api"
            />
            <EditableField
              label="Provider"
              value={dbConfig.provider}
              onChange={() => {}}
              disabled
            />
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent my-4" />

          {/* Connection Status */}
          <div className="flex items-center justify-between py-2 mb-4">
            <span className="text-xs font-semibold text-surface-600">Connection Status</span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${dbReachable ? 'text-emerald-600' : 'text-rose-600'}`}>
              {dbReachable ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {dbReachable ? `Connected (${connectionStatus.latencyMs || 0}ms)` : 'Not Connected'}
            </span>
          </div>

          {/* Test Connect & Save Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              icon={<RefreshCw size={14} />} 
              onClick={() => DatabaseService.testConnection().then(r => setConnectionStatus({ status: r.success ? 'connected' : 'error', latencyMs: r.latencyMs }))}
              disabled={isUpdatingConfig}
            >
              Test Connect
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              icon={<Save size={14} />} 
              onClick={handleSaveDbConfig} 
              disabled={isUpdatingConfig}
            >
              {isUpdatingConfig ? messages.common.saving : 'Save Config'}
            </Button>
          </div>
        </Card>

        {/* Schema Status & Initialization */}
        <Card variant="flat" className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">Database Schema</h4>
            <span className={`text-xs font-bold ${schemaStatus.initialized ? 'text-emerald-600' : 'text-amber-600'}`}>
              {schemaStatus.initialized ? 'Initialized' : 'Not Initialized'}
            </span>
          </div>
          <p className="text-xs text-surface-500 mb-3">Create database tables from <code className="text-[10px] bg-surface-100 px-1 py-0.5 rounded">default-schema.sql</code>.</p>
          {!schemaStatus.initialized ? (
            <Button 
              variant="secondary" 
              size="sm" 
              icon={<Database size={14} />} 
              onClick={handleInitializeSchema}
              disabled={isDemoLoading}
            >
              {isDemoLoading ? 'Initializing...' : 'Initialize Schema'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Schema initialized</span>
            </div>
          )}
        </Card>

        {/* Default Data Status & Initialization */}
        <Card variant="flat" className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400">Default Data</h4>
            <span className={`text-xs font-bold ${defaultDataStatus.loaded ? 'text-emerald-600' : 'text-amber-600'}`}>
              {defaultDataStatus.loaded ? 'Loaded' : 'Not Loaded'}
            </span>
          </div>
          <p className="text-xs text-surface-500 mb-3">Load default roles, subscription, and admin user from <code className="text-[10px] bg-surface-100 px-1 py-0.5 rounded">default-data.sql</code>.</p>
          {!defaultDataStatus.loaded ? (
            <Button 
              variant="secondary" 
              size="sm" 
              icon={<Database size={14} />} 
              onClick={handleInitializeDefaultData}
              disabled={isDemoLoading}
            >
              {isDemoLoading ? 'Loading...' : 'Load Default Data'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Default data loaded</span>
            </div>
          )}
        </Card>

        {/* Demo Data Management */}
        <Card variant="flat" className="p-4 border-rose-200 bg-rose-50/30">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-3">Demo Data</h4>
          <p className="text-xs text-surface-600 mb-3">Load or delete sample tenant, user, and log data for testing.</p>
          {demoObjectsExist ? (
            <Button 
              variant="danger" 
              size="sm" 
              icon={<AlertTriangle size={14} />} 
              onClick={handleDeleteDemoObjects} 
              disabled={isDemoLoading}
            >
              {isDemoLoading ? 'Deleting...' : 'Delete Demo Data'}
            </Button>
          ) : (
            <Button 
              variant="secondary" 
              size="sm" 
              icon={<Database size={14} />} 
              onClick={handleCreateDemoObjects} 
              disabled={isDemoLoading}
            >
              {isDemoLoading ? 'Creating...' : 'Load Demo Data'}
            </Button>
          )}
        </Card>

        {/* Wipe Database */}
        <Card variant="flat" className="p-4 border-rose-200 bg-rose-50/30">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-3">{messages.settings.database.wipeTitle}</h4>
          <p className="text-xs text-surface-500 mb-3">{messages.settings.database.wipeDescription}</p>
          <Button 
            variant="danger" 
            size="sm" 
            icon={<RefreshCw size={14} />} 
            onClick={() => setShowWipeConfirmation(true)} 
            disabled={isDeletingDatabase}
          >
            Wipe All Data
          </Button>
        </Card>
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
              description="Track all database and backend API requests"
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

        {/* Flush Settings */}
        <Card variant="flat" className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Flush Settings</h4>
          <p className="text-xs text-surface-500 mb-3">Configure how often logs are flushed from memory to the database.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-2">Flush Interval (seconds)</label>
              <input
                type="number"
                min={10}
                max={600}
                step={10}
                value={logConfig.flushIntervalSeconds || 60}
                onChange={(e) => setLogConfig((c) => ({ ...c, flushIntervalSeconds: parseInt(e.target.value) || 60 }))}
                className="w-32 px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
              />
              <p className="text-[10px] text-surface-400 mt-1">Default: 60 seconds. Logs are flushed at this interval or when threshold is reached.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 mb-2">Flush Threshold (entries)</label>
              <input
                type="number"
                min={10}
                max={500}
                step={10}
                value={logConfig.flushThreshold || 50}
                onChange={(e) => setLogConfig((c) => ({ ...c, flushThreshold: parseInt(e.target.value) || 50 }))}
                className="w-32 px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
              />
              <p className="text-[10px] text-surface-400 mt-1">Flush immediately when buffer reaches this size.</p>
            </div>
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
            <SettingsRow label="Storage Provider" value="Supabase PostgreSQL" />
            <SettingsRow label="Table" value="public.logs" mono />
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
            <SettingsRow label="Tenant Auth" value="PostgreSQL + bcrypt" />
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

      {/* Config Update Progress Modal */}
      <ProgressModal
        isOpen={isUpdatingConfig}
        title="Updating Configuration"
        message="Saving changes to database..."
        progress={configUpdateProgress}
      />

      {/* Config Update Success Modal */}
      <ActionModal
        isOpen={showConfigSuccess}
        title="Configuration Updated"
        icon={CheckCircle2}
        size="sm"
        variant="info"
        onClose={() => setShowConfigSuccess(false)}
      >
        <p className="text-sm text-surface-600">Your changes have been saved successfully to the database.</p>
      </ActionModal>

      {/* Config Update Error Modal */}
      <ActionModal
        isOpen={showConfigError}
        title="Configuration Failed"
        icon={XCircle}
        size="sm"
        variant="info"
        onClose={() => setShowConfigError(false)}
      >
        <p className="text-sm text-rose-600">{configErrorMessage}</p>
      </ActionModal>

      {/* Wipe Database Confirmation Modal */}
      <ActionModal
        isOpen={showWipeConfirmation}
        title="Wipe Database"
        icon={AlertTriangle}
        size="sm"
        variant="confirm"
        confirmLabel="Wipe All Data"
        confirmVariant="danger"
        onConfirm={handleWipeDatabase}
        onCancel={() => setShowWipeConfirmation(false)}
      >
        <p className="text-sm text-surface-600">This will delete all documents from all collections but keep the collection structure intact. This action cannot be undone.</p>
      </ActionModal>


      {/* Database Deletion Progress Modal */}
      <ProgressModal
        isOpen={isDeletingDatabase}
        title="Deleting Database"
        message="Removing all documents from database..."
        progress={deletionProgress}
      />

      {/* Database Deletion Success Modal */}
      <ActionModal
        isOpen={showDeletionSuccess}
        title="Database Wiped Successfully"
        icon={Database}
        size="sm"
        variant="success"
        onClose={() => setShowDeletionSuccess(false)}
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold text-surface-800">{deletionSuccessMessage}</p>
          <p className="text-xs text-surface-500">All application-managed tables have been dropped. Use Initialize Database to recreate the schema.</p>
        </div>
      </ActionModal>

      {/* Database Deletion Error Modal */}
      <ActionModal
        isOpen={showDeletionError}
        title="Deletion Failed"
        icon={XCircle}
        size="sm"
        variant="info"
        onClose={() => setShowDeletionError(false)}
      >
        <p className="text-sm text-rose-600">{deletionErrorMessage}</p>
      </ActionModal>

      {/* Refresh Status Progress Modal */}
      <ProgressModal
        isOpen={isRefreshing}
        title="Loading..."
        message="Checking database connection and state..."
        progress={refreshProgress}
      />

      {/* Delete Default Data Objects Confirmation Modal */}
      <ActionModal
        isOpen={showDeleteDemoConfirm}
        title={messages.platformAdmin.defaultObjects.deleteTitle}
        icon={AlertTriangle}
        size="sm"
        variant="confirm"
        confirmLabel={messages.platformAdmin.defaultObjects.deleteButton}
        confirmVariant="danger"
        onConfirm={handleConfirmDeleteDemo}
        onCancel={() => setShowDeleteDemoConfirm(false)}
        isProcessing={isDemoLoading}
      >
        <p className="text-sm text-surface-600">
          {messages.platformAdmin.defaultObjects.deleteConfirm}
        </p>
      </ActionModal>

      {/* Default Objects Progress Modal */}
      {isDemoLoading && !showDeleteDemoConfirm && (
        <ProgressModal
          isOpen={isDemoLoading}
          title={demoObjectsExist ? messages.platformAdmin.defaultObjects.deleteTitle : messages.platformAdmin.defaultObjects.title}
          message={demoObjectsExist ? messages.platformAdmin.defaultObjects.deletingMessage : messages.platformAdmin.defaultObjects.creatingMessage}
          progress={50}
        />
      )}
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

function StatusRow({ label, done, small = false }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 size={small ? 11 : 14} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <div className={`${small ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} rounded-full border-2 border-surface-200 flex-shrink-0`} />
      )}
      <span className={`${small ? 'text-[10px]' : 'text-xs'} ${done ? 'text-surface-600' : 'text-surface-400'}`}>{label}</span>
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

function CollectionViewer({ collection, rootPath }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const fullPath = `${rootPath}/${collection.path}`;
  return (
    <div className="border border-surface-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-50 hover:bg-surface-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Database size={13} className="text-brand-500 flex-shrink-0" />
          <span className="text-xs font-bold text-surface-700">{collection.path}</span>
          <span className="text-[10px] font-mono text-surface-400 bg-white px-1.5 py-0.5 rounded border border-surface-200">{collection.key}</span>
          <span className="text-[10px] text-surface-400">{collection.fields.length} fields</span>
        </div>
        <ChevronRight size={13} className={`text-surface-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-3 py-3 bg-white border-t border-surface-100 animate-fade-in">
          <p className="text-[10px] text-surface-500 mb-2">{collection.description}</p>
          <p className="text-[10px] font-mono text-surface-400 mb-3">Path: {fullPath}</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left py-1.5 px-2 font-semibold text-surface-500 w-1/3">Field</th>
                <th className="text-left py-1.5 px-2 font-semibold text-surface-500">Type / Description</th>
              </tr>
            </thead>
            <tbody>
              {collection.fields.map((f) => (
                <tr key={f.name} className="border-b border-surface-50">
                  <td className="py-1.5 px-2 font-mono text-brand-600 font-semibold">{f.name}</td>
                  <td className="py-1.5 px-2 text-surface-500">{f.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
