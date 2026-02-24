// ============================================================================
// ActionModal — The ONE modal for all user interactions across the platform.
//
// ARCHITECTURE NOTE:
// This wraps the base Modal component and adds a standardized footer with
// action buttons. Every confirmation, CRUD form, and wizard uses this.
// The caller controls: title, content, and footer actions.
//
// Variants:
//   - confirm:  "Are you sure?" with Cancel + Confirm buttons
//   - form:     CRUD form with Cancel + Save buttons
//   - wizard:   Multi-step with Back + Next/Finish buttons
//   - info:     Read-only with just a Close button
//   - custom:   Caller provides its own footer via `footer` prop
//
// Usage:
//   <ActionModal
//     isOpen={show}
//     onClose={close}
//     title="Delete Tenant"
//     variant="confirm"
//     confirmLabel="Delete"
//     confirmVariant="danger"
//     onConfirm={handleDelete}
//     isProcessing={deleting}
//   >
//     <p>This will permanently delete the tenant and all its data.</p>
//   </ActionModal>
// ============================================================================
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ActionModal({
  // Modal chrome
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',

  // Variant controls the footer layout
  variant = 'confirm',

  // Action handlers
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',

  // State
  isProcessing = false,
  isSuccess = false,
  successMessage = 'Action completed successfully!',

  // Custom footer (overrides variant footer)
  footer,

  // Content
  children,
}) {
  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  // Success state — shown after a confirmed action completes
  if (isOpen && isSuccess) {
    return (
      <Modal isOpen={true} onClose={onClose} size="sm">
        <div className="text-center py-6 animate-fade-in">
          <div className="inline-flex p-3 rounded-full bg-emerald-50 mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-surface-800 mb-1">{successMessage}</h3>
          <p className="text-sm text-surface-400 mb-6">You can close this dialog now.</p>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  // Determine footer based on variant
  const renderFooter = () => {
    if (footer) return footer;

    switch (variant) {
      case 'confirm':
        return (
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-surface-100 mt-5">
            <Button variant="ghost" onClick={handleCancel} disabled={isProcessing}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              isLoading={isProcessing}
              icon={confirmVariant === 'danger' ? <AlertTriangle size={15} /> : undefined}
            >
              {confirmLabel}
            </Button>
          </div>
        );

      case 'form':
        return (
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-surface-100 mt-5">
            <Button variant="ghost" onClick={handleCancel} disabled={isProcessing}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              isLoading={isProcessing}
            >
              {confirmLabel}
            </Button>
          </div>
        );

      case 'info':
        return (
          <div className="flex items-center justify-end pt-5 border-t border-surface-100 mt-5">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        );

      case 'wizard':
      case 'custom':
        // Wizard and custom variants: caller provides footer or manages buttons inside children
        return null;

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? undefined : onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      size={size}
    >
      {children}
      {renderFooter()}
    </Modal>
  );
}
