// ============================================================================
// Card — A container with consistent padding, border, and shadow.
//
// Usage:
//   <Card>Content here</Card>
//   <Card variant="elevated" className="p-8">Elevated card</Card>
// ============================================================================
import React from 'react';

const VARIANTS = {
  default:  'bg-white border border-surface-200/80 shadow-sm',
  elevated: 'bg-white border border-surface-200/60 shadow-md shadow-surface-200/50',
  flat:     'bg-surface-50 border border-surface-200/60',
  glass:    'bg-white/70 backdrop-blur-xl border border-white/40 shadow-lg shadow-surface-200/30',
};

export default function Card({
  children,
  variant = 'default',
  className = '',
  ...props
}) {
  return (
    <div
      className={`rounded-xl ${VARIANTS[variant] || VARIANTS.default} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
