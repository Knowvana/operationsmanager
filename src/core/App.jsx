// ============================================================================
// App.jsx — The Thin Orchestrator
//
// ARCHITECTURE NOTE:
// This file has ONE job: decide WHAT to render based on app state.
// It contains ZERO business logic, ZERO UI markup, ZERO module code.
//
// Routing strategy (no router library needed yet):
//   URL /admin-setup  → SystemAdminLogin  (JSON-based auth)
//   URL /register     → UserRegistrationWizard overlay
//   URL /             → HomePage with Sign In modal overlay
//
// After login:
//   System Admin → PlatformDashboard
//   Tenant User  → TenantAdminDashboard
//
// The global TopNav is used on EVERY page via:
//   - HomePage (passes onLogin/onRegister to TopNav)
//   - AppShell (wraps PlatformDashboard and TenantAdminDashboard)
//
// Sign In is shown as a MODAL over the HomePage (not a separate page).
// ============================================================================
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { Logger, PlatformService, ActionModal, LoginForm } from '@shared';
import SystemAdminLogin from './auth/SystemAdminLogin';
import PlatformDashboard from './PlatformDashboard';
import TenantAdminDashboard from './views/TenantAdminDashboard';
import HomePage from './views/HomePage';
import UserRegistrationWizard from './setup/UserRegistrationWizard';
import UserService from '../shared/services/userService';
import appConfig from '@config/app.json';

export default function App() {
  // --- Application State ---
  const [user, setUser] = useState(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Check if database is already initialized on app mount
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        console.log('[App] Checking if database is initialized...');
        const isInitialized = await PlatformService.isDatabaseInitialized();
        console.log('[App] Database initialized check result:', isInitialized);
        if (isInitialized) {
          setIsDatabaseReady(true);
          Logger.info('App', 'Database already initialized', { isInitialized: true });
        } else {
          Logger.info('App', 'Database not yet initialized', { isInitialized: false });
        }
      } catch (err) {
        console.error('[App] Error checking database:', err);
        Logger.error('App', 'Failed to check database status', { error: err.message });
      }
    };
    checkDatabase();
  }, []);

  // Determine login mode from URL path
  const currentPath = useMemo(() => window.location.pathname, []);
  const isAdminSetupRoute = currentPath === '/admin-setup';
  const isRegisterRoute = currentPath === '/register';

  // Auto-open registration wizard on /register route
  useEffect(() => {
    if (isRegisterRoute && !user) {
      setShowRegistration(true);
    }
  }, [isRegisterRoute, user]);

  // --- Auth Handlers ---
  const handleLogin = useCallback((authenticatedUser) => {
    setUser(authenticatedUser);
    setShowLoginModal(false);
    Logger.setUser(authenticatedUser.email);
    Logger.info('App', 'User authenticated', { email: authenticatedUser.email, role: authenticatedUser.role });
  }, []);

  // Tenant login handler for the Sign In modal
  const handleTenantLogin = useCallback(async (email, password) => {
    Logger.info('Auth', 'Tenant login attempt', { email });
    const authenticatedUser = await UserService.authenticateUser(email, password);
    Logger.info('Auth', 'Tenant login successful', { email, userId: authenticatedUser.userId });
    handleLogin(authenticatedUser);
  }, [handleLogin]);

  const handleLogout = useCallback(() => {
    Logger.info('App', 'User logged out', { email: user?.email });
    Logger.setUser(null);
    setUser(null);
    setIsDatabaseReady(false);
  }, [user]);

  const handleDatabaseReady = useCallback(() => {
    setIsDatabaseReady(true);
  }, []);

  // Registration complete: auto-login the newly created user
  const handleRegistrationComplete = useCallback((registeredUser) => {
    setShowRegistration(false);
    setUser(registeredUser);
    Logger.setUser(registeredUser.email);
    Logger.info('App', 'User registered and auto-logged in', { email: registeredUser.email, userId: registeredUser.userId });
  }, []);

  const handleOpenRegistration = useCallback(() => {
    setShowLoginModal(false);
    setShowRegistration(true);
  }, []);

  const handleShowLogin = useCallback(() => {
    setShowRegistration(false);
    setShowLoginModal(true);
  }, []);

  // --- Render Decision Tree ---

  // Gate 1: Not authenticated → Show HomePage with modals
  if (!user) {
    // Admin setup route always shows admin login (full page)
    if (isAdminSetupRoute) {
      return (
        <SystemAdminLogin
          appName={appConfig.appName}
          onLogin={handleLogin}
          isDatabaseReady={isDatabaseReady}
          onDatabaseReady={handleDatabaseReady}
        />
      );
    }

    // Default: HomePage + Sign In modal + Registration modal
    return (
      <>
        <HomePage
          appName={appConfig.appName}
          onLogin={handleShowLogin}
          onRegister={handleOpenRegistration}
        />
        {/* Sign In Modal — overlays on top of HomePage */}
        <ActionModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title="Sign In"
          icon={Layers}
          size="sm"
          variant="custom"
        >
          <LoginForm
            onLogin={handleTenantLogin}
            appName={appConfig.appName}
            title="Sign In"
            subtitle="Enter your credentials to access your workspace"
            icon={Layers}
            accentColor="brand"
            embedded
            footerHint={
              <span>
                Don't have an account?{' '}
                <button onClick={handleOpenRegistration} className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
                  Register here
                </button>
              </span>
            }
          />
        </ActionModal>
        <UserRegistrationWizard
          isOpen={showRegistration}
          onClose={() => setShowRegistration(false)}
          onComplete={handleRegistrationComplete}
        />
      </>
    );
  }

  // Gate 2: System Admin authenticated → Platform Dashboard
  if (user.isSystemAdmin) {
    return (
      <PlatformDashboard
        user={user}
        onLogout={handleLogout}
        appName={appConfig.appName}
        isDatabaseReady={isDatabaseReady}
        onDatabaseReady={handleDatabaseReady}
      />
    );
  }

  // Gate 3: Tenant user authenticated → Tenant Admin Dashboard
  return (
    <TenantAdminDashboard
      user={user}
      onLogout={handleLogout}
      appName={appConfig.appName}
    />
  );
}
