// ============================================================================
// EmptyState — Shown when a page/section has no data yet.
//
// Usage:
//   <EmptyState
//     icon={<Database size={40} />}
//     title="No tasks yet"
//     description="Import or create your first task to get started."
//     action={<Button onClick={handleCreate}>Create Task</Button>}
//   />
// ============================================================================
import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="p-4 rounded-2xl bg-gradient-to-br from-surface-100 to-surface-50 mb-5">
        {icon || <Inbox size={40} className="text-surface-300" />}
      </div>
      <h3 className="text-lg font-bold text-surface-700 mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-surface-400 max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
