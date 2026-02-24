// ============================================================================
// SystemAdminLogin — Thin wrapper around the shared LoginForm.
//
// ARCHITECTURE NOTE:
// This file contains ONLY the auth logic (validate against JSON config).
// The UI is 100% delegated to the shared LoginForm component.
// This is the pattern for all login pages:
//   1. Define an auth handler (JSON, Firebase, OAuth, etc.)
//   2. Pass it to <LoginForm onLogin={handler} /> with branding props
//
// Route: /admin-setup
// ============================================================================
import React from 'react';
import { Shield } from 'lucide-react';
import { LoginForm, Logger } from '@shared';
import systemAdminConfig from '@config/system-admin.json';

export default function SystemAdminLogin({ onLogin, appName = 'Operations Manager' }) {

  // Auth handler: validate against the local JSON config file
  const handleAdminLogin = async (email, password) => {
    Logger.info('Auth', 'System admin login attempt', { email });
    // Brief delay for UX (feels more secure than instant)
    await new Promise((r) => setTimeout(r, 600));

    if (
      email.toLowerCase() === systemAdminConfig.email.toLowerCase() &&
      password === systemAdminConfig.password
    ) {
      Logger.info('Auth', 'System admin login successful', { email: systemAdminConfig.email, role: systemAdminConfig.role });
      onLogin({
        email: systemAdminConfig.email,
        displayName: systemAdminConfig.displayName,
        role: systemAdminConfig.role,
        permissions: systemAdminConfig.permissions,
        isSystemAdmin: true,
      });
    } else {
      Logger.warn('Auth', 'System admin login failed — invalid credentials', { email });
      throw new Error('Invalid credentials. Check your system admin configuration.');
    }
  };

  return (
    <LoginForm
      onLogin={handleAdminLogin}
      appName={appName}
      title="Admin Sign In"
      subtitle="System Administration"
      icon={Shield}
      accentColor="amber"
      defaultEmail={systemAdminConfig.email}
      defaultPassword={systemAdminConfig.password}
      footerHint={
        <>
          Default credentials are defined in{' '}
          <code className="px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 font-mono text-[11px]">
            config/system-admin.json
          </code>
        </>
      }
    />
  );
}
