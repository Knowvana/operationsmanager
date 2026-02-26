// ============================================================================
// TenantLogin — The default login screen for tenant users.
//
// ARCHITECTURE NOTE:
// Authenticates against the PostgreSQL Users table via UserService.
// Users register via the UserRegistrationWizard and log in here.
// Password is verified against the bcrypt hash stored in the database.
//
// Route: / (default)
// ============================================================================
import React from 'react';
import { Layers } from 'lucide-react';
import { LoginForm, Logger, UserService } from '@shared';

export default function TenantLogin({ onLogin, onRegister, onBack, appName = 'Operations Manager' }) {

  // Auth handler: authenticate against PostgreSQL Users table
  const handleTenantLogin = async (email, password) => {
    Logger.info('Auth', 'Tenant login attempt', { email });
    const user = await UserService.authenticateUser(email, password);
    Logger.info('Auth', 'Tenant login successful', { email, userId: user.userId });
    onLogin(user);
  };

  return (
    <LoginForm
      onLogin={handleTenantLogin}
      appName={appName}
      title="Sign In"
      subtitle="Enter your credentials to access your workspace"
      icon={Layers}
      accentColor="brand"
      footerHint={
        <>
          {onRegister && (
            <>
              Don't have an account?{' '}
              <button onClick={onRegister} className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
                Register here
              </button>
            </>
          )}
          {onBack && (
            <>
              {onRegister && <span className="mx-2">·</span>}
              <button onClick={onBack} className="text-surface-500 font-semibold hover:text-surface-700 transition-colors">
                ← Back to Home
              </button>
            </>
          )}
        </>
      }
    />
  );
}
