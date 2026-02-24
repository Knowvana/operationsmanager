// ============================================================================
// SuccessModal — Reusable modal for showing operation success.
//
// ARCHITECTURE NOTE:
// Used throughout the app to confirm successful completion of operations.
// Auto-closes after a delay or when user clicks the button.
//
// Usage:
//   <SuccessModal
//     isOpen={isSuccess}
//     title="Configuration Updated"
//     message="Your changes have been saved successfully."
//     onClose={handleClose}
//     autoCloseMs={2000}
//   />
// ============================================================================
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import Button from './Button';

export default function SuccessModal({ isOpen, title, message, onClose }) {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-fade-in">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-emerald-50">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
        </div>

        {/* Header */}
        <h2 className="text-lg font-bold text-surface-800 text-center mb-2">{title}</h2>

        {/* Message */}
        <p className="text-sm text-surface-600 text-center mb-6">{message}</p>

        {/* Button */}
        <Button variant="primary" size="md" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
