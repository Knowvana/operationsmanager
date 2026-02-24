// ============================================================================
// App.jsx — The Thin Orchestrator
//
// ARCHITECTURE NOTE:
// This file has ONE job: decide WHAT to render based on app state.
// It contains ZERO business logic, ZERO UI markup, ZERO module code.
//
// Routing strategy (no router library needed yet):
//   URL /admin-setup  → SystemAdminLogin  (JSON-based auth)
//   URL /register     → UserRegistrationWizard (self-service registration)
//   URL /             → TenantLogin       (Firestore-based auth)
//
// After login:
//   System Admin → PlatformDashboard (with DB Setup Wizard as modal)
//   Tenant User  → ComingSoon (placeholder until modules are built)
//
// WHY URL-based login?
//   - Tenant users should NEVER see the admin login page
//   - Admin setup URL can be bookmarked / shared securely
//   - Same LoginForm component, different auth handler + branding
// ============================================================================
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Logger, PlatformService } from '@shared';
import SystemAdminLogin from './auth/SystemAdminLogin';
import TenantLogin from './auth/TenantLogin';
import PlatformDashboard from './PlatformDashboard';
import ComingSoon from './views/ComingSoon';
import UserRegistrationWizard from './setup/UserRegistrationWizard';
import appConfig from '@config/app.json';

export default function App() {
  // --- Application State ---
  const [user, setUser] = useState(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

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
    Logger.setUser(authenticatedUser.email);
    Logger.info('App', 'User authenticated', { email: authenticatedUser.email, role: authenticatedUser.role });
  }, []);

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
    setShowRegistration(true);
  }, []);

  // --- Render Decision Tree ---

  // Gate 1: Not authenticated → Show appropriate login screen
  if (!user) {
    return (
      <>
        {isAdminSetupRoute ? (
          <SystemAdminLogin
            onLogin={handleLogin}
            appName={appConfig.appName}
          />
        ) : (
          <TenantLogin
            onLogin={handleLogin}
            onRegister={handleOpenRegistration}
            appName={appConfig.appName}
          />
        )}

        {/* Registration Wizard — overlays the login screen */}
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

  // Gate 3: Tenant user authenticated → ComingSoon (modules not built yet)
  return (
    <ComingSoon
      user={user}
      onLogout={handleLogout}
      appName={appConfig.appName}
    />
  );
}
