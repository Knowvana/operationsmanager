// ============================================================================
// Input — Universal text input with label, error state, and icon support.
//
// Usage:
//   <Input label="Email" type="email" value={email} onChange={setEmail} />
//   <Input label="Password" type="password" error="Required" icon={<Lock />} />
// ============================================================================
import React, { forwardRef } from 'react';

const Input = forwardRef(function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  icon,
  disabled = false,
  required = false,
  className = '',
  ...props
}, ref) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-surface-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-surface-800
            placeholder:text-surface-400
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400
            disabled:bg-surface-100 disabled:text-surface-400 disabled:cursor-not-allowed
            ${icon ? 'pl-10' : ''}
            ${error
              ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-400'
              : 'border-surface-200 hover:border-surface-300'
            }
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-rose-500 font-medium">{error}</p>
      )}
    </div>
  );
});

export default Input;
