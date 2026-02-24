// ============================================================================
// PageHeader — Consistent page title bar used inside the main content area.
//
// Usage:
//   <PageHeader
//     title="Task Management"
//     subtitle="12 tasks today"
//     actions={<Button>Add Task</Button>}
//   />
// ============================================================================
import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = '',
}) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-gradient-to-br from-brand-50 to-teal-50">
            <Icon size={20} className="text-brand-600" />
          </div>
        )}
        <div>
          {title && <h1 className="text-xl font-bold text-surface-800">{title}</h1>}
          {subtitle && <p className="text-sm text-surface-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
