// ============================================================================
// UserRegistrationWizard — Self-service user registration + tenant creation.
//
// ARCHITECTURE NOTE:
// Uses the reusable StepWizard component. Two steps:
//   Step 1: Create Account (email, name, password)
//   Step 2: Create Tenant (using shared CreateTenantForm in 'user' mode)
//
// After both steps, the user is logged in and redirected to the app.
// Password is hashed via AuthService before storage (same as admin).
// ============================================================================
import React, { useState } from 'react';
import {
  UserPlus, Building2, ArrowRight, CheckCircle2,
  AlertCircle, Loader2, Eye, EyeOff
} from 'lucide-react';
import { Button, Card, StepWizard, Logger, CreateTenantForm } from '@shared';
import UserService from '../../shared/services/userService';
import PlatformService from '../../shared/services/platformService';

export default function UserRegistrationWizard({ isOpen, onClose, onComplete }) {
  // Step 1 state: Account creation
  const [accountData, setAccountData] = useState({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [accountStatus, setAccountStatus] = useState(null); // null | 'creating' | 'success' | 'error'
  const [accountError, setAccountError] = useState('');
  const [createdUser, setCreatedUser] = useState(null);

  // Step 2 state: Tenant creation
  const [tenantStatus, setTenantStatus] = useState(null);
  const [tenantError, setTenantError] = useState('');

  const updateAccount = (field, value) => {
    setAccountData((prev) => ({ ...prev, [field]: value }));
  };

  // --- Step 1: Create Account ---
  const handleCreateAccount = async (onNext) => {
    // Validation
    if (!accountData.email.trim()) { setAccountError('Email is required.'); return; }
    if (!accountData.displayName.trim()) { setAccountError('Full name is required.'); return; }
    if (accountData.password.length < 6) { setAccountError('Password must be at least 6 characters.'); return; }
    if (accountData.password !== accountData.confirmPassword) { setAccountError('Passwords do not match.'); return; }

    setAccountStatus('creating');
    setAccountError('');
    try {
      const user = await UserService.registerUser({
        email: accountData.email,
        displayName: accountData.displayName,
        password: accountData.password,
        phone: accountData.phone,
      });
      setCreatedUser(user);
      setAccountStatus('success');
      Logger.info('Registration', `Account created: ${accountData.email}`, { userId: user.id });
      // Auto-advance to next step after brief delay
      setTimeout(() => onNext(), 800);
    } catch (err) {
      setAccountStatus('error');
      setAccountError(err.message || 'Failed to create account.');
      Logger.error('Registration', 'Account creation failed', { error: err.message });
    }
  };

  // --- Step 2: Create Tenant ---
  const handleCreateTenant = async (formData) => {
    if (!createdUser) return;
    setTenantStatus('creating');
    setTenantError('');
    try {
      const tenant = await PlatformService.createTenant({
        ...formData,
        status: 'trial',
        plan: 'free',
      });
      // Link user to tenant
      await UserService.linkUserToTenant(createdUser.id, tenant.id);
      setTenantStatus('success');
      Logger.info('Registration', `Tenant created and linked: ${formData.name}`, {
        userId: createdUser.id,
        tenantId: tenant.id,
      });
      // Auto-complete after brief delay
      setTimeout(() => {
        onComplete?.({
          ...createdUser,
          tenantId: tenant.id,
          isTenantUser: true,
          isSystemAdmin: false,
        });
      }, 1000);
    } catch (err) {
      setTenantStatus('error');
      setTenantError(err.message || 'Failed to create tenant.');
      Logger.error('Registration', 'Tenant creation failed', { error: err.message });
    }
  };

  // --- Step Content Renderers ---
  const renderAccountStep = ({ onNext }) => (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-surface-500">
        Create your account to get started. Your password is securely hashed before storage.
      </p>

      <div className="space-y-3">
        <FormField label="Full Name" required>
          <input
            type="text"
            value={accountData.displayName}
            onChange={(e) => updateAccount('displayName', e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
          />
        </FormField>
        <FormField label="Email Address" required>
          <input
            type="email"
            value={accountData.email}
            onChange={(e) => updateAccount('email', e.target.value)}
            placeholder="you@company.com"
            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
          />
        </FormField>
        <FormField label="Phone (optional)">
          <input
            type="tel"
            value={accountData.phone}
            onChange={(e) => updateAccount('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
          />
        </FormField>

        <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent" />

        <FormField label="Password" required hint="Min 6 characters">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={accountData.password}
              onChange={(e) => updateAccount('password', e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 pr-10 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>
        <FormField label="Confirm Password" required>
          <input
            type={showPassword ? 'text' : 'password'}
            value={accountData.confirmPassword}
            onChange={(e) => updateAccount('confirmPassword', e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
          />
        </FormField>
      </div>

      {/* Status Messages */}
      {accountStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-slide-up">
          <CheckCircle2 size={16} />
          <span className="font-semibold">Account created successfully!</span>
        </div>
      )}
      {accountError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm animate-slide-up">
          <AlertCircle size={16} />
          <span>{accountError}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {accountStatus !== 'success' ? (
          <Button
            onClick={() => handleCreateAccount(onNext)}
            isLoading={accountStatus === 'creating'}
            icon={<UserPlus size={16} />}
          >
            Create Account
          </Button>
        ) : (
          <Button onClick={onNext} iconRight={<ArrowRight size={16} />}>
            Next: Create Tenant
          </Button>
        )}
      </div>
    </div>
  );

  const renderTenantStep = ({ onBack }) => (
    <div className="space-y-4 animate-fade-in">
      {tenantStatus === 'success' ? (
        <div className="text-center py-8 animate-fade-in">
          <div className="inline-flex p-3 rounded-full bg-emerald-50 mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-surface-800 mb-1">Welcome aboard!</h3>
          <p className="text-sm text-surface-400">Your account and tenant have been created. Redirecting...</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-surface-500">
            Create your organization workspace. You can customize it later.
          </p>

          {tenantError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm animate-slide-up">
              <AlertCircle size={16} />
              <span>{tenantError}</span>
            </div>
          )}

          <CreateTenantForm
            mode="user"
            onSubmit={handleCreateTenant}
            onCancel={onBack}
            isLoading={tenantStatus === 'creating'}
            submitLabel="Create Tenant & Finish"
          />
        </>
      )}
    </div>
  );

  // Step definitions
  const wizardSteps = [
    { id: 'account', label: 'Create Account', icon: UserPlus, content: renderAccountStep },
    { id: 'tenant', label: 'Create Tenant', icon: Building2, content: renderTenantStep },
  ];

  return (
    <StepWizard
      isOpen={isOpen}
      onClose={onClose}
      title="Register"
      subtitle="Create your account and organization"
      icon={UserPlus}
      size="lg"
      steps={wizardSteps}
    />
  );
}

// --- Local sub-component ---
function FormField({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-600 mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
        {hint && <span className="text-surface-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
