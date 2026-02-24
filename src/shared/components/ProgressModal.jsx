// ============================================================================
// ProgressModal — Reusable modal for showing operation progress.
//
// ARCHITECTURE NOTE:
// Used throughout the app for long-running operations (database updates,
// file uploads, etc.). Shows a title, message, and progress bar.
//
// Usage:
//   <ProgressModal
//     isOpen={isProcessing}
//     title="Updating Configuration"
//     message="Saving changes to database..."
//     progress={45}
//   />
// ============================================================================
import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ProgressModal({ isOpen, title, message, progress = 0 }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Loader2 size={20} className="text-brand-500 animate-spin" />
          <h2 className="text-lg font-bold text-surface-800">{title}</h2>
        </div>

        {/* Message */}
        <p className="text-sm text-surface-600 mb-6">{message}</p>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-surface-400 text-right">{Math.round(progress)}%</p>
        </div>
      </div>
    </div>
  );
}
