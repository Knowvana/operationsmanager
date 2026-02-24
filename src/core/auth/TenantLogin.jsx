// ============================================================================
// TenantLogin — The default login screen for tenant users.
//
// ARCHITECTURE NOTE:
// Same shared LoginForm, different auth handler.
// When Firebase is configured, this will call Firebase Auth.
// For now, it shows a friendly message that the platform is being set up.
//
// Route: / (default)
// ============================================================================
import React from 'react';
import { Layers } from 'lucide-react';
import { LoginForm, Logger } from '@shared';

export default function TenantLogin({ onLogin, appName = 'Operations Manager' }) {

  // Auth handler: will use Firebase Auth once configured
  const handleTenantLogin = async (email, password) => {
    Logger.info('Auth', 'Tenant login attempt', { email });
    // TODO: Replace with Firebase Auth when database is configured
    // const user = await signInWithEmailAndPassword(auth, email, password);
    // onLogin(user);
    Logger.warn('Auth', 'Tenant login unavailable — platform not yet configured', { email });
    throw new Error(
      'Tenant login is not yet available. The platform is being set up by the administrator.'
    );
  };

  return (
    <LoginForm
      onLogin={handleTenantLogin}
      appName={appName}
      title="Sign In"
      subtitle="Enter your credentials to access your workspace"
      icon={Layers}
      accentColor="brand"
    />
  );
}
