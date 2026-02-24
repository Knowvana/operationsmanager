// ============================================================================
// ConfirmationModal — Reusable modal for confirming destructive actions.
//
// ARCHITECTURE NOTE:
// Used for operations that cannot be undone (delete, wipe, reset, etc.).
// Shows warning icon, title, message, and two action buttons (Cancel/Confirm).
//
// Usage:
//   <ConfirmationModal
//     isOpen={isConfirming}
//     title="Delete Database"
//     message="This action cannot be undone. All data will be permanently deleted."
//     confirmText="Delete"
//     cancelText="Cancel"
//     isDangerous={true}
//     onConfirm={handleDelete}
//     onCancel={handleCancel}
//   />
// ============================================================================
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-fade-in">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`p-3 rounded-full ${isDangerous ? 'bg-rose-50' : 'bg-amber-50'}`}>
            <AlertTriangle size={32} className={isDangerous ? 'text-rose-600' : 'text-amber-600'} />
          </div>
        </div>

        {/* Header */}
        <h2 className="text-lg font-bold text-surface-800 text-center mb-2">{title}</h2>

        {/* Message */}
        <p className="text-sm text-surface-600 text-center mb-6">{message}</p>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={isDangerous ? 'danger' : 'primary'}
            size="md"
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
