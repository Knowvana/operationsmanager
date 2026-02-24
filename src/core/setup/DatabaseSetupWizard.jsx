// ============================================================================
// DatabaseSetupWizard — Modal content for Firebase database configuration.
//
// ARCHITECTURE NOTE:
// This is NOT a full-page component. It renders INSIDE an ActionModal
// (wizard variant) that overlays the AppShell. The admin sees the platform
// layout behind the modal — reinforcing that the platform is ready and
// just needs database configuration.
//
// The parent (PlatformDashboard) controls the modal open/close state.
// This component only manages the wizard steps and Firebase logic.
//
// Flow:
//   Step 1: Review/edit Firebase config from firebase.json
//   Step 2: Test connection to Firebase
//   Step 3: Initialize Firestore collections from database-schema.json
// ============================================================================
import React, { useState } from 'react';
import {
  Database, CheckCircle2, AlertCircle, ArrowRight,
  Wifi, WifiOff, Loader2, Server, RefreshCw
} from 'lucide-react';
import { Button, Card, Input, StepWizard, Logger, AuthService } from '@shared';
import firebaseConfig from '@config/firebase.json';
import databaseSchema from '@config/database-schema.json';
import defaultData from '@config/default-data.json';

export default function DatabaseSetupWizard({ isOpen, onClose, onComplete }) {
  const [databaseName, setDatabaseName] = useState(databaseSchema.root_document || 'Knowvana');
  const [config, setConfig] = useState({
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || '',
    projectId: firebaseConfig.projectId || '',
    storageBucket: firebaseConfig.storageBucket || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
  });
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [initStatus, setInitStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  // Progress tracking
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');
    Logger.info('Database', 'Testing Firebase connection', { projectId: config.projectId });
    const startTime = Date.now();

    try {
      const { initializeApp, getApps, deleteApp } = await import('firebase/app');
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');

      const existingApps = getApps();
      const testApp = existingApps.find(a => a.name === 'setup-test');
      if (testApp) await deleteApp(testApp);

      const app = initializeApp(config, 'setup-test');
      const db = getFirestore(app);

      await getDocs(collection(db, '_connection_test'));
      await deleteApp(app);

      Logger.api('GET', `Firestore/_connection_test`, 200, Date.now() - startTime);
      Logger.info('Database', 'Firebase connection test successful', { projectId: config.projectId });
      setConnectionStatus('success');
    } catch (error) {
      console.error('Connection test failed:', error);
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        Logger.api('GET', `Firestore/_connection_test`, 403, Date.now() - startTime);
        Logger.info('Database', 'Firebase connected (permission-denied is expected for test collection)');
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        setErrorMessage(error.message || 'Failed to connect to Firebase');
        Logger.api('GET', `Firestore/_connection_test`, 500, Date.now() - startTime, { error: error.message });
        Logger.error('Database', 'Firebase connection test failed', { error: error.message, code: error.code });
      }
    }
  };

  const handleInitializeDatabase = async () => {
    setInitStatus('initializing');
    setErrorMessage('');
    Logger.info('Database', 'Starting database initialization', { databaseName });
    const startTime = Date.now();

    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');

      const existingApps = getApps();
      let app = existingApps.find(a => a.name === '[DEFAULT]') || existingApps[0];
      if (!app) {
        app = initializeApp(config);
      }
      const db = getFirestore(app);
      const rootPath = `${databaseSchema.root_collection}/${databaseName}`;

      // Calculate total steps: only seed documents (collections created implicitly when first doc is written)
      const collectionsToCreate = Object.entries(databaseSchema.collections);
      let seedDocCount = 0;
      for (const [key] of collectionsToCreate) {
        if (defaultData[key]) {
          seedDocCount += Object.keys(defaultData[key]).length;
        }
      }
      const totalSteps = seedDocCount;
      let currentStep = 0;

      // Seed default data from default-data.json
      // Collections are created implicitly when the first document is written
      setProgress({ current: 0, total: totalSteps, label: 'Seeding default data...' });

      for (const [collectionKey, documents] of Object.entries(defaultData)) {
        if (collectionKey.startsWith('_')) continue; // skip metadata keys
        const collectionDef = databaseSchema.collections[collectionKey];
        if (!collectionDef) continue;

        const collectionPath = `${rootPath}/${collectionDef.path}`;

        for (const [docId, docData] of Object.entries(documents)) {
          setProgress({ current: currentStep, total: totalSteps, label: `Seeding ${collectionDef.path}/${docId}...` });

          // Build the document, handling special cases
          const documentToWrite = { ...docData, createdAt: serverTimestamp() };

          // Hash passwords for system_admins
          if (collectionKey === 'system_admins' && docData.password_plain) {
            documentToWrite.passwordHash = await AuthService.hashPassword(docData.password_plain);
            delete documentToWrite.password_plain;
            delete documentToWrite._note_password;
          }

          // Remove any JSON metadata keys
          Object.keys(documentToWrite).forEach((k) => {
            if (k.startsWith('_note')) delete documentToWrite[k];
          });

          await setDoc(doc(db, collectionPath, docId), documentToWrite, { merge: true });
          Logger.api('POST', `Firestore/${collectionPath}/${docId}`, 200, Date.now() - startTime);
          currentStep++;
        }
      }

      setProgress({ current: totalSteps, total: totalSteps, label: 'Complete!' });
      Logger.info('Database', 'Database initialized successfully', {
        databaseName,
        rootPath,
        collectionsCreated: collectionsToCreate.map(([k]) => k),
        seedDocuments: seedDocCount,
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
        Configure your database name and Firebase credentials. The database name is the root collection under which all platform data will be stored.
      </p>

      {/* Database Name — the root document name in Firestore */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-brand-50/50 to-teal-50/50 border border-brand-100">
        <Input
          label="Default Database Name"
          value={databaseName}
          onChange={setDatabaseName}
          placeholder="Knowvana"
        />
        <p className="text-[10px] text-surface-400 mt-1">
          All documents will be created under: <code className="font-mono text-brand-600">platforms/{databaseName}/...</code>
        </p>
      </div>

      <div className="pt-1">
        <p className="text-xs font-semibold text-surface-500 mb-3">Firebase Credentials</p>
      </div>
      <Input label="API Key" value={config.apiKey} onChange={(v) => handleConfigChange('apiKey', v)} placeholder="AIza..." />
      <Input label="Auth Domain" value={config.authDomain} onChange={(v) => handleConfigChange('authDomain', v)} placeholder="your-project.firebaseapp.com" />
      <Input label="Project ID" value={config.projectId} onChange={(v) => handleConfigChange('projectId', v)} placeholder="your-project-id" />
      <Input label="Storage Bucket" value={config.storageBucket} onChange={(v) => handleConfigChange('storageBucket', v)} placeholder="your-project.appspot.com" />
      <Input label="App ID" value={config.appId} onChange={(v) => handleConfigChange('appId', v)} placeholder="1:123:web:abc" />
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
        Test the connection to your Firebase project before initializing the database.
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
            <p className="text-xs text-surface-400">Firebase project: {config.projectId}</p>
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
        This will create collections from your schema and seed default data (admin user, config, initial log entry).
      </p>

      {/* What will be created */}
      <Card variant="flat" className="p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Schema Collections</h4>
        <div className="space-y-2">
          {Object.entries(databaseSchema.collections).map(([key, col]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <Database size={14} className="text-brand-500" />
              <span className="font-mono text-xs text-surface-600">{col.path}</span>
              <span className="text-xs text-surface-400 hidden sm:inline">— {col.description?.substring(0, 50)}...</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-surface-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-2">Default Data</h4>
          <div className="space-y-1">
            {Object.entries(defaultData).filter(([k]) => !k.startsWith('_')).map(([key, docs]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-surface-500">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span>{key}: {Object.keys(docs).length} document(s)</span>
                {key === 'system_admins' && <span className="text-[10px] text-amber-500 font-semibold">(password will be hashed)</span>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Progress Bar — shown during initialization */}
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
          <p className="text-[10px] text-surface-400 mt-2 font-mono truncate">
            {progress.label}
          </p>
          <p className="text-[10px] text-surface-300 mt-0.5">
            Step {progress.current} of {progress.total}
          </p>
        </Card>
      )}

      {initStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-slide-up">
          <CheckCircle2 size={16} />
          <div>
            <span className="font-semibold">Database initialized successfully!</span>
            <p className="text-xs text-emerald-600 mt-0.5">{progress.total} operations completed.</p>
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

  // Step definitions for the reusable StepWizard
  const wizardSteps = [
    { id: 'config', label: 'Firebase Config', icon: Server, content: renderStepConfig },
    { id: 'test', label: 'Test Connection', icon: Wifi, content: renderStepTest },
    { id: 'initialize', label: 'Initialize DB', icon: Database, content: renderStepInitialize },
  ];

  return (
    <StepWizard
      isOpen={isOpen}
      onClose={onClose}
      title="Database Setup"
      subtitle="Configure and initialize your Firebase database"
      icon={Database}
      size="lg"
      steps={wizardSteps}
      onComplete={handleComplete}
    />
  );
}
