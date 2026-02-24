// ============================================================================
// UserRegistrationWizard — Self-service user registration + tenant creation.
//
// ARCHITECTURE NOTE:
// Renders as a modal with vertical step tabs on the left.
// 4 steps: Create Account → Tenant Details → License → Summary
//
// Features:
//   - Professional phone input with country code selector
//   - Instant email & phone validation against DB (as user types)
//   - Tenant contact email auto-populated from user email
//   - License step defaults to Free tier (5 users)
//   - Summary shows all data before submission
//   - Progress modal during creation, success/error feedback
//   - Cancel resets form and closes modal
//   - Back button and left tab clicks navigate between steps
//   - User document uses email as document ID
// ============================================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  UserPlus, Building2, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, Loader2, Eye, EyeOff, LogIn, Shield, X,
  FileText, CreditCard, Phone, XCircle, CheckCircle2 as CheckIcon
} from 'lucide-react';
import { Button, Card, Modal, Logger, ActionModal } from '@shared';
import UserService from '../../shared/services/userService';
import PlatformService from '../../shared/services/platformService';
import messages from '@config/messages.json';

const COUNTRY_CODES = [
  { code: '+1', label: 'US/CA', flag: '🇺🇸' },
  { code: '+44', label: 'UK', flag: '🇬🇧' },
  { code: '+91', label: 'IN', flag: '🇮🇳' },
  { code: '+61', label: 'AU', flag: '🇦🇺' },
  { code: '+49', label: 'DE', flag: '🇩🇪' },
  { code: '+33', label: 'FR', flag: '🇫🇷' },
  { code: '+81', label: 'JP', flag: '🇯🇵' },
  { code: '+86', label: 'CN', flag: '🇨🇳' },
  { code: '+971', label: 'UAE', flag: '🇦🇪' },
  { code: '+65', label: 'SG', flag: '🇸🇬' },
];

const STEPS = [
  { id: 'account', label: 'Account Details', icon: UserPlus },
  { id: 'tenant', label: 'Tenant Details', icon: Building2 },
  { id: 'license', label: 'License', icon: CreditCard },
  { id: 'summary', label: 'Summary', icon: FileText },
];

const INITIAL_ACCOUNT = { email: '', displayName: '', password: '', confirmPassword: '', countryCode: '+1', phoneNumber: '' };
const INITIAL_TENANT = { name: '', contactEmail: '', industry: '', size: '1-50' };

export default function UserRegistrationWizard({ isOpen, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [accountData, setAccountData] = useState({ ...INITIAL_ACCOUNT });
  const [tenantData, setTenantData] = useState({ ...INITIAL_TENANT });
  const [licenseTier, setLicenseTier] = useState('free');
  const [showPassword, setShowPassword] = useState(false);

  // Validation states
  const [fieldErrors, setFieldErrors] = useState({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitLabel, setSubmitLabel] = useState('');
  const [submitResult, setSubmitResult] = useState(null); // null | 'success' | 'error'
  const [submitError, setSubmitError] = useState('');
  const [createdUser, setCreatedUser] = useState(null);
  const [createdTenantId, setCreatedTenantId] = useState(null);

  // Debounce refs
  const emailTimerRef = useRef(null);
  const phoneTimerRef = useRef(null);

  // --- Reset ---
  const resetForm = useCallback(() => {
    setCurrentStep(0);
    setAccountData({ ...INITIAL_ACCOUNT });
    setTenantData({ ...INITIAL_TENANT });
    setLicenseTier('free');
    setShowPassword(false);
    setFieldErrors({});
    setEmailChecking(false);
    setEmailTaken(false);
    setPhoneChecking(false);
    setIsSubmitting(false);
    setSubmitProgress(0);
    setSubmitLabel('');
    setSubmitResult(null);
    setSubmitError('');
    setCreatedUser(null);
    setCreatedTenantId(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose?.();
  }, [resetForm, onClose]);

  // --- Instant email validation (debounced) ---
  const handleEmailChange = useCallback((value) => {
    setAccountData(p => ({ ...p, email: value }));
    setFieldErrors(p => ({ ...p, email: null }));
    setEmailTaken(false);
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);

    const emailRegex = new RegExp(messages.validation.emailRegex);
    if (!value.trim()) return;
    if (!emailRegex.test(value.trim())) {
      setFieldErrors(p => ({ ...p, email: messages.auth.errors.emailInvalid }));
      return;
    }
    // Check DB
    setEmailChecking(true);
    emailTimerRef.current = setTimeout(async () => {
      try {
        const taken = await UserService.isEmailTaken(value.trim().toLowerCase());
        setEmailTaken(taken);
        if (taken) setFieldErrors(p => ({ ...p, email: messages.auth.errors.duplicateEmail }));
      } catch { /* ignore */ }
      setEmailChecking(false);
    }, 600);
  }, []);

  // --- Auto-populate tenant contact email from user email ---
  useEffect(() => {
    if (accountData.email && !tenantData.contactEmail) {
      setTenantData(p => ({ ...p, contactEmail: accountData.email }));
    }
  }, [accountData.email]);

  // --- Validate current step ---
  const validateStep = useCallback((step) => {
    const errors = {};
    const emailRegex = new RegExp(messages.validation.emailRegex);
    const nameRegex = new RegExp(messages.validation.nameRegex);
    const phoneRegex = new RegExp(messages.validation.phoneRegex);

    if (step === 0) {
      if (!accountData.displayName.trim()) errors.displayName = messages.auth.errors.nameRequired;
      else if (!nameRegex.test(accountData.displayName.trim())) errors.displayName = messages.auth.errors.nameInvalid;
      if (!accountData.email.trim()) errors.email = messages.auth.errors.emailRequired;
      else if (!emailRegex.test(accountData.email.trim())) errors.email = messages.auth.errors.emailInvalid;
      else if (emailTaken) errors.email = messages.auth.errors.duplicateEmail;
      if (accountData.phoneNumber.trim()) {
        const fullPhone = `${accountData.countryCode} ${accountData.phoneNumber}`;
        if (!phoneRegex.test(fullPhone)) errors.phone = messages.auth.errors.phoneInvalid;
      }
      if (accountData.password.length < messages.validation.minPasswordLength) errors.password = messages.auth.errors.weakPassword;
      if (accountData.password !== accountData.confirmPassword) errors.confirmPassword = messages.auth.errors.passwordMismatch;
    }
    if (step === 1) {
      const tenantNameRegex = new RegExp(messages.validation.tenantNameRegex);
      if (!tenantData.name.trim()) errors.tenantName = messages.tenant.errors.nameRequired;
      else if (!tenantNameRegex.test(tenantData.name.trim())) errors.tenantName = messages.tenant.errors.nameInvalid;
      if (!tenantData.contactEmail.trim()) errors.tenantEmail = messages.tenant.errors.contactRequired;
      else if (!emailRegex.test(tenantData.contactEmail.trim())) errors.tenantEmail = messages.tenant.errors.contactInvalid;
    }
    return errors;
  }, [accountData, tenantData, emailTaken]);

  // --- Navigation ---
  const goToStep = useCallback((targetStep) => {
    // Validate before advancing forward
    if (targetStep > currentStep) {
      for (let i = currentStep; i < targetStep; i++) {
        const errors = validateStep(i);
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          setCurrentStep(i);
          return;
        }
      }
    }
    setFieldErrors({});
    setCurrentStep(targetStep);
  }, [currentStep, validateStep]);

  const handleNext = useCallback(() => {
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  }, [currentStep]);

  // --- Submit: Create User + Tenant ---
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitProgress(10);
    setSubmitLabel('Creating your account...');
    setSubmitResult(null);
    setSubmitError('');
    try {
      // Step 1: Register user
      setSubmitProgress(20);
      const fullPhone = accountData.phoneNumber ? `${accountData.countryCode} ${accountData.phoneNumber}` : '';
      const user = await UserService.registerUser({
        email: accountData.email,
        displayName: accountData.displayName,
        password: accountData.password,
        phone: fullPhone,
      });
      setCreatedUser(user);
      setSubmitProgress(50);
      setSubmitLabel('Creating your organization...');
      Logger.info('Registration', `Account created: ${accountData.email}`, { userId: user.id });

      // Step 2: Create tenant
      const tenant = await PlatformService.createTenant({
        name: tenantData.name,
        contactEmail: tenantData.contactEmail,
        industry: tenantData.industry,
        size: tenantData.size,
        status: 'trial',
        plan: licenseTier,
      });
      setSubmitProgress(75);
      setSubmitLabel('Linking account to organization...');

      // Step 3: Link user to tenant
      await UserService.linkUserToTenant(user.id, tenant.id);
      await UserService.updateUser(user.id, { role: 'tenant_admin' });
      setCreatedTenantId(tenant.id);
      setSubmitProgress(100);
      setSubmitLabel('Complete!');
      setSubmitResult('success');
      Logger.info('Registration', 'Registration complete', { userId: user.id, tenantId: tenant.id });
    } catch (err) {
      setSubmitResult('error');
      setSubmitError(err.message || 'Registration failed. Please try again.');
      Logger.error('Registration', 'Registration failed', { error: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }, [accountData, tenantData, licenseTier]);

  // --- Go to dashboard ---
  const handleGoToDashboard = useCallback(() => {
    onComplete?.({
      ...createdUser,
      tenantId: createdTenantId,
      role: 'tenant_admin',
      isTenantUser: true,
      isSystemAdmin: false,
    });
    resetForm();
  }, [createdUser, createdTenantId, onComplete, resetForm]);

  if (!isOpen) return null;

  const tierInfo = messages.tenant.tiers[licenseTier] || messages.tenant.tiers.free;
  const fullPhone = accountData.phoneNumber ? `${accountData.countryCode} ${accountData.phoneNumber}` : '—';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New User Registration" subtitle="Create New User and Tenant in Application Database" icon={UserPlus} size="xl">
      <div className="flex gap-0 -mt-2" style={{ minHeight: 580 }}>
        {/* ─── Left: Vertical Step Tabs ─── */}
        <div className="w-48 flex-shrink-0 border-r border-surface-100 pr-4 pt-2">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            const isClickable = idx <= currentStep || (idx <= currentStep + 1);
            return (
              <button
                key={step.id}
                onClick={() => isClickable && goToStep(idx)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left mb-1 transition-all text-xs font-semibold ${
                  isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' :
                  isCompleted ? 'text-emerald-600 hover:bg-emerald-50' :
                  isClickable ? 'text-surface-400 hover:bg-surface-50 hover:text-surface-600' :
                  'text-surface-300 cursor-not-allowed'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  isActive ? 'bg-brand-600 text-white' :
                  isCompleted ? 'bg-emerald-500 text-white' :
                  'bg-surface-200 text-surface-400'
                }`}>
                  {isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
                </div>
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Right: Step Content ─── */}
        <div className="flex-1 pl-6 pt-2 overflow-y-auto">
          {/* Step 1: Create Account */}
          {currentStep === 0 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-surface-500 mb-3">{messages.registration.step1Description}</p>
              <WizField label="Full Name" required error={fieldErrors.displayName}>
                <input type="text" value={accountData.displayName}
                  onChange={e => { setAccountData(p => ({ ...p, displayName: e.target.value })); setFieldErrors(p => ({ ...p, displayName: null })); }}
                  placeholder="John Doe" className="wiz-input" />
              </WizField>
              <WizField label="Email Address" required error={fieldErrors.email}>
                <div className="space-y-2">
                  <input type="email" value={accountData.email}
                    onChange={e => handleEmailChange(e.target.value)}
                    placeholder="you@company.com" className="wiz-input" />
                  {emailChecking && (
                    <div className="space-y-1.5">
                      <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full animate-pulse" style={{ width: '100%', animationDuration: '2s', animationIterationCount: 'infinite' }} />
                      </div>
                      <p className="text-[10px] text-brand-600 font-semibold">Validating email...</p>
                    </div>
                  )}
                  {!emailChecking && accountData.email && !fieldErrors.email && !emailTaken && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-[10px] text-emerald-600 font-semibold">{messages.auth.success.emailAvailable}</span>
                    </div>
                  )}
                  {!emailChecking && emailTaken && (
                    <div className="flex items-center gap-1.5">
                      <XCircle size={14} className="text-rose-500 flex-shrink-0" />
                      <span className="text-[10px] text-rose-600 font-semibold">{messages.auth.errors.duplicateEmail}</span>
                    </div>
                  )}
                </div>
              </WizField>
              <WizField label="Phone Number" error={fieldErrors.phone}>
                <div className="flex gap-2">
                  <select value={accountData.countryCode}
                    onChange={e => setAccountData(p => ({ ...p, countryCode: e.target.value }))}
                    className="w-28 px-2 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200">
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input type="tel" value={accountData.phoneNumber}
                    onChange={e => { setAccountData(p => ({ ...p, phoneNumber: e.target.value })); setFieldErrors(p => ({ ...p, phone: null })); }}
                    placeholder="(555) 123-4567" className="wiz-input flex-1" />
                </div>
              </WizField>
              <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent" />
              <WizField label="Password" required hint={`Min ${messages.validation.minPasswordLength} chars`} error={fieldErrors.password}>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={accountData.password}
                    onChange={e => { setAccountData(p => ({ ...p, password: e.target.value })); setFieldErrors(p => ({ ...p, password: null })); }}
                    placeholder="••••••••" className="wiz-input pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </WizField>
              <WizField label="Confirm Password" required error={fieldErrors.confirmPassword}>
                <input type={showPassword ? 'text' : 'password'} value={accountData.confirmPassword}
                  onChange={e => { setAccountData(p => ({ ...p, confirmPassword: e.target.value })); setFieldErrors(p => ({ ...p, confirmPassword: null })); }}
                  placeholder="••••••••" className="wiz-input" />
              </WizField>
            </div>
          )}

          {/* Step 2: Tenant Details */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-surface-500 mb-3">{messages.registration.step2Description}</p>
              <WizField label="Tenant Name (Organization Name)" required error={fieldErrors.tenantName}>
                <input type="text" value={tenantData.name}
                  onChange={e => { setTenantData(p => ({ ...p, name: e.target.value })); setFieldErrors(p => ({ ...p, tenantName: null })); }}
                  placeholder="My Company" className="wiz-input" />
              </WizField>
              <WizField label="Contact Email" required error={fieldErrors.tenantEmail}>
                <input type="email" value={tenantData.contactEmail}
                  disabled
                  placeholder="contact@company.com" className="wiz-input opacity-60 cursor-not-allowed bg-surface-50" />
                <p className="text-[10px] text-surface-400 mt-1">Auto-populated from your email. Linked to your user account.</p>
              </WizField>
              <WizField label="Industry">
                <select value={tenantData.industry}
                  onChange={e => setTenantData(p => ({ ...p, industry: e.target.value }))}
                  className="wiz-input">
                  <option value="">Select industry...</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Education">Education</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Other">Other</option>
                </select>
              </WizField>
              <WizField label="Organization Size">
                <select value={tenantData.size}
                  onChange={e => setTenantData(p => ({ ...p, size: e.target.value }))}
                  className="wiz-input">
                  <option value="1-50">1–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-500">201–500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
              </WizField>
            </div>
          )}

          {/* Step 3: License */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-surface-500 mb-3">Select your license tier. You can upgrade anytime.</p>
              <div className="space-y-3">
                {Object.entries(messages.tenant.tiers).filter(([key]) => key === 'free').map(([key, tier]) => (
                  <button key={key} onClick={() => setLicenseTier(key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      licenseTier === key ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-100' : 'border-surface-200 hover:border-surface-300 bg-white'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-surface-800">{tier.label}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{tier.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        licenseTier === key ? 'border-brand-500 bg-brand-500' : 'border-surface-300'
                      }`}>
                        {licenseTier === key && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                    </div>
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-600">RECOMMENDED TO START</span>
                  </button>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700 font-semibold">More tiers coming soon</p>
                <p className="text-[10px] text-amber-600 mt-1">Premium and Enterprise plans will be available soon. Contact support for early access.</p>
              </div>
            </div>
          )}

          {/* Step 4: Summary */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              {submitResult === 'success' ? (
                <div className="text-center py-6">
                  <div className="inline-flex p-4 rounded-full bg-emerald-50 mb-4">
                    <CheckCircle2 size={40} className="text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-bold text-surface-800 mb-2">{messages.auth.success.registrationComplete}</h3>
                  <p className="text-sm text-surface-500 mb-6">{messages.auth.success.registrationCompleteMessage}</p>
                  <Button variant="primary" size="lg" icon={<LogIn size={18} />} onClick={handleGoToDashboard} className="w-full">
                    Go to Tenant Admin Dashboard
                  </Button>
                </div>
              ) : submitResult === 'error' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                    <AlertCircle size={16} />
                    <span>{submitError}</span>
                  </div>
                  <Button variant="primary" onClick={handleSubmit}>Retry</Button>
                </div>
              ) : isSubmitting ? (
                <div className="py-8 text-center">
                  <Loader2 size={32} className="mx-auto text-brand-500 animate-spin mb-4" />
                  <p className="text-sm font-semibold text-surface-700 mb-2">{submitLabel}</p>
                  <div className="w-full h-2.5 bg-surface-100 rounded-full overflow-hidden max-w-xs mx-auto">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full transition-all duration-300" style={{ width: `${submitProgress}%` }} />
                  </div>
                  <p className="text-[10px] text-surface-400 mt-2">{submitProgress}%</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-surface-500 mb-3">Review your details before creating your account and organization.</p>
                  <SummarySection title="Account Details">
                    <SummaryRow label="Name" value={accountData.displayName} />
                    <SummaryRow label="Email" value={accountData.email} />
                    <SummaryRow label="Phone" value={fullPhone} />
                  </SummarySection>
                  <SummarySection title="Tenant Details">
                    <SummaryRow label="Organization" value={tenantData.name} />
                    <SummaryRow label="Contact Email" value={tenantData.contactEmail} />
                    <SummaryRow label="Industry" value={tenantData.industry || '—'} />
                    <SummaryRow label="Size" value={tenantData.size} />
                  </SummarySection>
                  <SummarySection title="License">
                    <SummaryRow label="Tier" value={tierInfo.label} />
                    <SummaryRow label="Max Users" value={tierInfo.maxUsers === -1 ? 'Unlimited' : String(tierInfo.maxUsers)} />
                  </SummarySection>
                  <div className="pb-2" />
                </>
              )}
            </div>
          )}

          {/* ─── Footer Buttons ─── */}
          {!isSubmitting && submitResult !== 'success' && (
            <div className="flex items-center justify-between pt-5 mt-4 border-t border-surface-100">
              {currentStep > 0 && (
                <Button variant="primary" size="sm" icon={<ArrowLeft size={14} />} onClick={handleBack}>Back</Button>
              )}
              {currentStep === 0 && <div />}
              {currentStep < STEPS.length - 1 ? (
                <Button variant="primary" size="sm" iconRight={<ArrowRight size={14} />} onClick={handleNext}>
                  Next Step — {STEPS[currentStep + 1].label}
                </Button>
              ) : submitResult !== 'error' ? (
                <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} onClick={handleSubmit}>
                  Create User and Tenant
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Global style for wiz-input — avoids duplication */}
      <style>{`.wiz-input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; outline: none; transition: all 0.15s; } .wiz-input:focus { box-shadow: 0 0 0 2px rgba(99,102,241,0.2); border-color: #818cf8; }`}</style>
    </Modal>
  );
}

// --- Sub-components ---
function WizField({ label, hint, required, error, checking, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-600 mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
        {hint && <span className="text-surface-400 font-normal ml-1">({hint})</span>}
        {checking && <Loader2 size={11} className="inline ml-1.5 text-brand-500 animate-spin" />}
      </label>
      {children}
      {error && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1 h-1 rounded-full bg-gradient-to-r from-rose-400 to-rose-500 flex-shrink-0" />
          <span className="text-[11px] font-medium bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">{error}</span>
        </div>
      )}
    </div>
  );
}

function SummarySection({ title, children }) {
  return (
    <div className="rounded-lg border border-surface-200 overflow-hidden">
      <div className="px-3 py-2 bg-surface-50 border-b border-surface-200">
        <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">{title}</p>
      </div>
      <div className="divide-y divide-surface-100">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-xs font-semibold text-surface-800 text-right">{value}</span>
    </div>
  );
}
