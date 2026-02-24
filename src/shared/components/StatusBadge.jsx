// ============================================================================
// StatusBadge — Consistent status indicator across all modules.
//
// Usage:
//   <StatusBadge status="active" />
//   <StatusBadge status="error" label="Failed" />
// ============================================================================
import React from 'react';

const STATUS_STYLES = {
  active:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-surface-50 text-surface-500 border-surface-200',
  warning:  'bg-amber-50 text-amber-700 border-amber-200',
  error:    'bg-rose-50 text-rose-700 border-rose-200',
  info:     'bg-brand-50 text-brand-700 border-brand-200',
  pending:  'bg-violet-50 text-violet-700 border-violet-200',
};

const STATUS_DOTS = {
  active:   'bg-emerald-500',
  inactive: 'bg-surface-400',
  warning:  'bg-amber-500',
  error:    'bg-rose-500',
  info:     'bg-brand-500',
  pending:  'bg-violet-500',
};

export default function StatusBadge({ status = 'info', label, className = '' }) {
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
      text-xs font-semibold border
      ${STATUS_STYLES[status] || STATUS_STYLES.info}
      ${className}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status] || STATUS_DOTS.info}`} />
      {displayLabel}
    </span>
  );
}
