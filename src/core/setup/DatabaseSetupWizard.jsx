// ============================================================================
// DatabaseSetupWizard — Modal content for PostgreSQL database configuration.
//
// ARCHITECTURE NOTE:
// This is NOT a full-page component. It renders INSIDE an ActionModal
// (wizard variant) that overlays the AppShell. The admin sees the platform
// layout behind the modal — reinforcing that the platform is ready and
// just needs database configuration.
//
// The parent (PlatformDashboard) controls the modal open/close state.
// This component only manages the wizard steps and Supabase/PG logic.
//
// Flow:
//   Step 1: Review/edit PostgreSQL config from pgsql.json
//   Step 2: Test connection to Supabase
//   Step 3: Initialize tables from default-schema.sql + seed default-data.sql
// ============================================================================
import React, { useState } from 'react';
import {
  Database, CheckCircle2, AlertCircle, ArrowRight,
  Wifi, WifiOff, Loader2, Server, RefreshCw, Table2
} from 'lucide-react';
import { Button, Card, Input, StepWizard, Logger, AuthService, DatabaseService } from '@shared';
import pgsqlConfig from '@config/pgsql.json';

const SCHEMA_TABLES = ['roles', 'subscriptions', 'tenants', 'application_admins', 'users', 'logs', 'system_config'];

export default function DatabaseSetupWizard({ isOpen, onClose, onComplete }) {
  const [config, setConfig] = useState({
    supabaseUrl: pgsqlConfig.supabaseUrl || '',
    supabaseAnonKey: pgsqlConfig.supabaseAnonKey || '',
    host: pgsqlConfig.host || '',
    port: pgsqlConfig.port || 5432,
    database: pgsqlConfig.database || 'postgres',
  });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionLatency, setConnectionLatency] = useState(0);
  const [initStatus, setInitStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [schemaStatus, setSchemaStatus] = useState(null);

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');
    Logger.info('Database', 'Testing PostgreSQL connection', { host: config.host });

    try {
      const result = await DatabaseService.testConnection();
      setConnectionLatency(result.latencyMs);

      if (result.success) {
        Logger.info('Database', 'PostgreSQL connection test successful', { latencyMs: result.latencyMs });
        setConnectionStatus('success');
        // Also check schema
        const schema = await DatabaseService.checkSchemaStatus();
        setSchemaStatus(schema);
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.error || 'Failed to connect to PostgreSQL');
        Logger.error('Database', 'PostgreSQL connection test failed', { error: result.error });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Failed to connect to database');
      Logger.error('Database', 'PostgreSQL connection test failed', { error: error.message });
    }
  };

  const handleInitializeDatabase = async () => {
    setInitStatus('initializing');
    setErrorMessage('');
    Logger.info('Database', 'Starting database initialization');
    const startTime = Date.now();

    try {
      const totalSteps = 3; // schema + default data + verify
      setProgress({ current: 0, total: totalSteps, label: 'Creating database schema...' });

      // Step 1: Create schema
      const schemaResult = await DatabaseService.initializeSchema();
      setProgress({ current: 1, total: totalSteps, label: 'Seeding default data...' });

      // Step 2: Hash the admin password and load default data
      const adminHash = await AuthService.hashPassword('admin123');
      const dataResult = await DatabaseService.loadDefaultData(adminHash);
      setProgress({ current: 2, total: totalSteps, label: 'Verifying...' });

      // Step 3: Verify
      const schema = await DatabaseService.checkSchemaStatus();
      const defaultData = await DatabaseService.checkDefaultDataStatus();
      setSchemaStatus(schema);
      setProgress({ current: totalSteps, total: totalSteps, label: 'Complete!' });

      Logger.info('Database', 'Database initialized successfully', {
        schemaInitialized: schema.initialized,
        defaultDataLoaded: defaultData.loaded,
        durationMs: Date.now() - startTime,
      });
      setInitStatus('success');
    } catch (error) {
      console.error('Database initialization failed:', error);
      setInitStatus('error');
      setErrorMessage(error.message || 'Failed to initialize database');
      Logger.error('Database', 'Database initialization failed', { error: error.message });
    }
  };

  const handleComplete = () => {
    onComplete?.();
    onClose?.();
  };

  // --- Step Content Renderers ---

  const renderStepConfig = ({ onNext }) => (
    <div className="space-y-4 animate-fade-in">
      <p className="text-sm text-surface-500 mb-4">
        Configure your Supabase PostgreSQL connection. These credentials are stored in <code className="text-xs bg-surface-100 px-1 py-0.5 rounded">pgsql.json</code>.
      </p>

      <div className="p-3 rounded-lg bg-gradient-to-r from-brand-50/50 to-teal-50/50 border border-brand-100">
        <Input
          label="Supabase Project URL"
          value={config.supabaseUrl}
          onChange={(v) => handleConfigChange('supabaseUrl', v)}
          placeholder="https://your-project.supabase.co"
        />
        <p className="text-[10px] text-surface-400 mt-1">
          Found in Supabase Dashboard → Settings → API → Project URL
        </p>
      </div>

      <Input
        label="Supabase Anon Key"
        value={config.supabaseAnonKey}
        onChange={(v) => handleConfigChange('supabaseAnonKey', v)}
        placeholder="eyJhbGciOi..."
        type="password"
      />

      <div className="pt-2 border-t border-surface-100">
        <p className="text-xs font-semibold text-surface-500 mb-3">Direct Connection (read-only)</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Host" value={config.host} disabled />
          <Input label="Port" value={String(config.port)} disabled />
        </div>
        <Input label="Database" value={config.database} disabled />
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button onClick={onNext} iconRight={<ArrowRight size={16} />}>
          Next: Test Connection
        </Button>
      </div>
    </div>
  );

  const renderStepTest = ({ onNext, onBack }) => (
    <div className="space-y-6 animate-fade-in">
      <p className="text-sm text-surface-500">
        Test the connection to your Supabase PostgreSQL database.
      </p>

      <Card variant="flat" className="p-6 text-center">
        {connectionStatus === null && (
          <div className="space-y-3">
            <Wifi size={36} className="mx-auto text-surface-300" />
            <p className="text-sm text-surface-400">Ready to test connection</p>
          </div>
        )}
        {connectionStatus === 'testing' && (
          <div className="space-y-3">
            <Loader2 size={36} className="mx-auto text-brand-500 animate-spin" />
            <p className="text-sm text-brand-600 font-medium">Testing connection...</p>
          </div>
        )}
        {connectionStatus === 'success' && (
          <div className="space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
            <p className="text-sm text-emerald-700 font-semibold">Connection successful!</p>
            <p className="text-xs text-surface-400">Latency: {connectionLatency}ms • Host: {config.host}</p>
            {schemaStatus && (
              <p className="text-xs text-surface-500">
                Schema: {schemaStatus.initialized ? `✓ All ${schemaStatus.tables.length} tables exist` : `${schemaStatus.missing.length} tables missing`}
              </p>
            )}
          </div>
        )}
        {connectionStatus === 'error' && (
          <div className="space-y-3">
            <WifiOff size={36} className="mx-auto text-rose-400" />
            <p className="text-sm text-rose-700 font-semibold">Connection failed</p>
            {errorMessage && <p className="text-xs text-rose-500">{errorMessage}</p>}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        {connectionStatus !== 'success' ? (
          <Button
            onClick={handleTestConnection}
            isLoading={connectionStatus === 'testing'}
            icon={connectionStatus === 'error' ? <RefreshCw size={16} /> : undefined}
          >
            {connectionStatus === 'error' ? 'Retry' : 'Test Connection'}
          </Button>
        ) : (
          <Button onClick={onNext} iconRight={<ArrowRight size={16} />}>
            Next: Initialize Database
          </Button>
        )}
      </div>
    </div>
  );

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const renderStepInitialize = ({ onBack }) => (
    <div className="space-y-6 animate-fade-in">
      <p className="text-sm text-surface-500">
        This will create all database tables and seed default data (roles, admin user, Free subscription, config).
      </p>

      {/* What will be created */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Database Tables</h4>
        <div className="grid grid-cols-2 gap-2">
          {SCHEMA_TABLES.map((table) => (
            <div key={table} className="flex items-center gap-2 text-sm">
              <Table2 size={14} className="text-brand-500" />
              <span className="font-mono text-xs text-surface-600">{table}</span>
              {schemaStatus && schemaStatus.tables.includes(table) && (
                <CheckCircle2 size={12} className="text-emerald-400" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-surface-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-2">Default Data</h4>
          <div className="space-y-1 text-xs text-surface-500">
            <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /><span>4 default roles (system_admin, tenant_admin, tenant_user, viewer)</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /><span>1 subscription (Free tier)</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /><span>1 application admin <span className="text-amber-500 font-semibold">(password hashed)</span></span></div>
            <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /><span>2 system config entries</span></div>
          </div>
        </div>
      </Card>

      {/* Progress Bar */}
      {initStatus === 'initializing' && (
        <Card variant="flat" className="p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-surface-600">Initializing Database...</span>
            <span className="text-xs font-bold text-brand-600">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-surface-400 mt-2 font-mono truncate">{progress.label}</p>
          <p className="text-[10px] text-surface-300 mt-0.5">Step {progress.current} of {progress.total}</p>
        </Card>
      )}

      {initStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-slide-up">
          <CheckCircle2 size={16} />
          <div>
            <span className="font-semibold">Database initialized successfully!</span>
            <p className="text-xs text-emerald-600 mt-0.5">Schema created and default data seeded.</p>
          </div>
        </div>
      )}
      {initStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm animate-slide-up">
          <AlertCircle size={16} />
          <span>{errorMessage || 'Initialization failed'}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack} disabled={initStatus === 'initializing'}>Back</Button>
        {initStatus !== 'success' ? (
          <Button
            variant="success"
            onClick={handleInitializeDatabase}
            isLoading={initStatus === 'initializing'}
            icon={<Database size={16} />}
          >
            {initStatus === 'error' ? 'Retry Initialization' : 'Initialize Database'}
          </Button>
        ) : (
          <Button onClick={handleComplete} iconRight={<ArrowRight size={16} />}>
            Done
          </Button>
        )}
      </div>
    </div>
  );

  const wizardSteps = [
    { id: 'config', label: 'Database Config', icon: Server, content: renderStepConfig },
    { id: 'test', label: 'Test Connection', icon: Wifi, content: renderStepTest },
    { id: 'initialize', label: 'Initialize DB', icon: Database, content: renderStepInitialize },
  ];

  return (
    <StepWizard
      isOpen={isOpen}
      onClose={onClose}
      title="Database Setup"
      subtitle="Configure and initialize your PostgreSQL database"
      icon={Database}
      size="lg"
      steps={wizardSteps}
      onComplete={handleComplete}
    />
  );
}
