// ============================================================================
// Modal — Overlay dialog used for forms, confirmations, and wizards.
//
// ARCHITECTURE NOTE:
// This is the ONLY modal component. All dialogs (settings, confirm, wizard)
// compose on top of this. Never create a separate modal from scratch.
//
// Usage:
//   <Modal isOpen={show} onClose={close} title="Edit User">
//     <form>...</form>
//   </Modal>
// ============================================================================
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  size = 'md',
  className = '',
  autoFit = false,
}) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const SIZES = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={`
        relative w-full ${SIZES[size] || SIZES.md} mx-4
        bg-white rounded-2xl shadow-2xl shadow-surface-900/10
        border border-surface-200/50
        animate-slide-up
        ${className}
      `}>
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2 rounded-lg bg-brand-50">
                  <Icon size={18} className="text-brand-600" />
                </div>
              )}
              <div>
                {title && <h2 className="text-lg font-bold text-surface-800">{title}</h2>}
                {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={`px-6 py-5 ${autoFit ? '' : 'max-h-[70vh] overflow-y-auto'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
