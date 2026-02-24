// ============================================================================
// SideNav — Left sidebar navigation for the active module.
//
// ARCHITECTURE NOTE:
// Each module provides its own nav items via its manifest. The SideNav
// receives these items as props and renders them. It never knows WHAT
// module is active — it just renders whatever items it's given.
//
// Structure:
//   [Module Title]
//   [Nav Item 1]  ← icon + label, highlights when active
//   [Nav Item 2]
//   ...
//   [Footer / collapse toggle]
// ============================================================================
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SideNav({
  title,
  items = [],
  activeItemId,
  onSelectItem,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  return (
    <aside className={`
      flex flex-col bg-white border-r border-surface-200/80
      transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-60'}
    `}>
      {/* Title + Collapse Toggle (top) */}
      <div className={`flex items-center border-b border-surface-100 ${isCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 pt-5 pb-3'}`}>
        {!isCollapsed && title && (
          <h2 className="text-xs font-bold uppercase tracking-wider text-surface-400">{title}</h2>
        )}
        <button
          onClick={toggleCollapse}
          className={`
            flex items-center gap-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-50 transition-colors
            ${isCollapsed ? 'p-2' : 'px-2 py-1.5'}
          `}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={14} />}
          {!isCollapsed && <span className="text-[10px] font-semibold uppercase tracking-wider">Collapse</span>}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeItemId;

          return (
            <button
              key={item.id}
              onClick={() => onSelectItem?.(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`
                w-full flex items-center gap-3 rounded-lg
                transition-all duration-200 group
                ${isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                ${isActive
                  ? 'bg-gradient-to-r from-brand-50 to-brand-50/50 text-brand-700 shadow-sm shadow-brand-100/50'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'
                }
              `}
            >
              {Icon && (
                <Icon
                  size={18}
                  className={`flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-surface-400 group-hover:text-surface-600'}`}
                />
              )}
              {!isCollapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {!isCollapsed && item.badge && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-600">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
