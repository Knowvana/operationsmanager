// ============================================================================
// ComingSoon — Placeholder page shown to authenticated tenant users.
//
// ARCHITECTURE NOTE:
// Displayed after a tenant user logs in, before any modules are available.
// This will be replaced by the Module Dashboard once modules are built.
// Uses the AppShell layout for consistent chrome (TopNav, etc.).
// ============================================================================
import React from 'react';
import { Rocket, Layers, Clock, Star } from 'lucide-react';
import { AppShell, Card, Button } from '@shared';

export default function ComingSoon({ user, onLogout, appName = 'Operations Manager' }) {
  return (
    <AppShell
      appName={appName}
      modules={[]}
      activeModuleId={null}
      onSwitchModule={() => {}}
      onLogout={onLogout}
      user={user}
    >
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="max-w-lg w-full text-center animate-fade-in">
          {/* Icon */}
          <div className="inline-flex p-5 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-100 shadow-sm shadow-brand-100/40 mb-6">
            <Rocket size={48} className="text-brand-500" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-surface-800 mb-2">
            Welcome, {user?.displayName || 'User'}!
          </h1>
          <p className="text-sm text-surface-500 mb-8">
            Your account is set up and ready. We're working on bringing you powerful modules to manage your operations.
          </p>

          {/* Feature Preview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <Card variant="flat" className="p-4 text-center">
              <Layers size={24} className="mx-auto text-brand-400 mb-2" />
              <p className="text-xs font-bold text-surface-700">Operations Monitor</p>
              <p className="text-[10px] text-surface-400 mt-1">Real-time task tracking</p>
            </Card>
            <Card variant="flat" className="p-4 text-center">
              <Clock size={24} className="mx-auto text-teal-400 mb-2" />
              <p className="text-xs font-bold text-surface-700">Shift Roster</p>
              <p className="text-[10px] text-surface-400 mt-1">Workforce scheduling</p>
            </Card>
            <Card variant="flat" className="p-4 text-center">
              <Star size={24} className="mx-auto text-amber-400 mb-2" />
              <p className="text-xs font-bold text-surface-700">More Coming</p>
              <p className="text-[10px] text-surface-400 mt-1">Custom modules</p>
            </Card>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-50 to-teal-50 border border-brand-200/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-surface-600">Modules coming soon</span>
          </div>

          {/* Tenant Info */}
          {user?.tenantId && (
            <p className="text-[10px] text-surface-400 mt-4 font-mono">
              Tenant: {user.tenantId}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
