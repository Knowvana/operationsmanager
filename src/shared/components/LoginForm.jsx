// ============================================================================
// LoginForm — The ONE reusable login component for the entire platform.
//
// ARCHITECTURE NOTE:
// This component handles ONLY the UI. It does NOT know how authentication
// works. The parent passes an `onLogin(email, password)` handler that
// determines the auth backend (JSON file, Firebase, etc.).
//
// Usage:
//   Tenant login:  <LoginForm onLogin={firebaseLogin} title="Sign In" />
//   Admin setup:   <LoginForm onLogin={jsonLogin} title="Admin Setup"
//                     icon={Shield} accentColor="amber" subtitle="System Administration" />
// ============================================================================
import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, AlertCircle, Layers } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import Card from './Card';

// Accent color presets — controls the gradient on the icon badge and button
const ACCENT_PRESETS = {
  brand: {
    iconBg:  'from-brand-500 to-teal-500',
    iconShadow: 'shadow-brand-200/50',
    button: 'primary',
  },
  amber: {
    iconBg:  'from-amber-500 to-orange-500',
    iconShadow: 'shadow-amber-200/50',
    button: 'primary',
  },
  emerald: {
    iconBg:  'from-emerald-500 to-teal-500',
    iconShadow: 'shadow-emerald-200/50',
    button: 'success',
  },
};

export default function LoginForm({
  onLogin,
  appName = 'Operations Manager',
  title = 'Sign In',
  subtitle,
  icon: Icon = Layers,
  accentColor = 'brand',
  footerHint,
  defaultEmail = '',
  defaultPassword = '',
  embedded = false,
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const accent = ACCENT_PRESETS[accentColor] || ACCENT_PRESETS.brand;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Embedded mode: just the form, no wrapper ---
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!embedded && (
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-surface-800">{title}</h2>
          <p className="text-xs text-surface-400 mt-1">
            Enter your credentials to continue
          </p>
        </div>
      )}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@company.com"
        icon={<Mail size={16} />}
        required
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Enter password"
        icon={<Lock size={16} />}
        required
      />

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm animate-slide-up">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        variant={accent.button}
        size="lg"
        isLoading={isLoading}
        iconRight={!isLoading ? <ArrowRight size={16} /> : undefined}
        className="w-full"
      >
        {isLoading ? 'Authenticating...' : 'Sign In'}
      </Button>

      {/* Footer hint — inside form for embedded mode */}
      {embedded && footerHint && (
        <p className="text-center text-xs text-surface-400 mt-4">{footerHint}</p>
      )}
    </form>
  );

  if (embedded) {
    return <div className="animate-fade-in">{formContent}</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-100 via-brand-50/30 to-teal-50/30 p-4">
      <div className="w-full max-w-md animate-fade-in">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${accent.iconBg} shadow-lg ${accent.iconShadow} mb-4`}>
            <Icon size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-surface-800">{appName}</h1>
          {subtitle && <p className="text-sm text-surface-400 mt-1">{subtitle}</p>}
        </div>

        {/* Login Card */}
        <Card variant="elevated" className="p-8">
          {formContent}
        </Card>

        {/* Footer hint — outside card for full-page mode */}
        {!embedded && footerHint && (
          <p className="text-center text-xs text-surface-400 mt-6">{footerHint}</p>
        )}
      </div>
    </div>
  );
}
