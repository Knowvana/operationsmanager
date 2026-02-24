// ============================================================================
// ErrorModal — Reusable modal for showing operation errors.
//
// ARCHITECTURE NOTE:
// Used throughout the app to display error messages with clear feedback.
// Shows an error icon, title, message, and action button.
//
// Usage:
//   <ErrorModal
//     isOpen={isError}
//     title="Configuration Failed"
//     message="Failed to save changes: Invalid database path"
//     onClose={handleClose}
//   />
// ============================================================================
import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';

export default function ErrorModal({ isOpen, title, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-fade-in">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-rose-50">
            <AlertCircle size={32} className="text-rose-600" />
          </div>
        </div>

        {/* Header */}
        <h2 className="text-lg font-bold text-surface-800 text-center mb-2">{title}</h2>

        {/* Message */}
        <p className="text-sm text-surface-600 text-center mb-6 break-words">{message}</p>

        {/* Button */}
        <Button variant="primary" size="md" className="w-full" onClick={onClose}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
