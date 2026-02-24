// ============================================================================
// Button — The universal button component for the entire platform.
//
// ARCHITECTURE NOTE:
// Every module uses THIS button. Never create module-specific buttons.
// Variants control appearance. Size controls dimensions. That's it.
//
// Usage:
//   <Button variant="primary" size="md" onClick={handleClick}>Save</Button>
//   <Button variant="ghost" icon={<Settings size={16} />}>Settings</Button>
//   <Button variant="danger" isLoading>Deleting...</Button>
// ============================================================================
import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:   'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-sm shadow-brand-200',
  secondary: 'bg-white text-surface-700 border border-surface-200 hover:bg-surface-50 shadow-sm',
  ghost:     'text-surface-600 hover:bg-surface-100 hover:text-surface-800',
  danger:    'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 shadow-sm shadow-rose-200',
  success:   'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-200',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-2.5 text-base rounded-xl gap-2.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      className={`${baseStyles} ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
      {iconRight && !isLoading && iconRight}
    </button>
  );
}
