// ============================================================================
// Spinner — Loading indicator used across the entire platform.
//
// Usage:
//   <Spinner />
//   <Spinner size="lg" label="Loading data..." />
// ============================================================================
import React from 'react';
import { Loader2 } from 'lucide-react';

const SIZES = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export default function Spinner({ size = 'md', label, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${SIZES[size] || SIZES.md} animate-spin text-brand-500`} />
      {label && (
        <p className="text-sm text-surface-400 font-medium">{label}</p>
      )}
    </div>
  );
}
