// ============================================================================
// SettingsConfig — Reusable settings layout with left vertical tabs.
//
// ARCHITECTURE NOTE:
// This is a GENERIC layout component for any settings/config view.
// It provides the STRUCTURE — the actual tab content is supplied by the caller.
//
// Structure:
//   ┌──────────────────────────────────────────────────────────────┐
//   │  [icon] Title                                    [actions]   │
//   │  subtitle                                                   │
//   ├──────────────┬──────────────────────────────────────────────┤
//   │  Tab 1       │                                              │
//   │  Tab 2  ●    │     Active Tab Content (scrollable)          │
//   │  Tab 3       │     (provided by caller)                     │
//   │              │                                              │
//   ├──────────────┴──────────────────────────────────────────────┤
//   │                                          [footer buttons]   │
//   └──────────────────────────────────────────────────────────────┘
//
// Usage:
//   <SettingsConfig
//     title="Platform Settings"
//     subtitle="Global configuration"
//     icon={Settings}
//     tabs={[
//       { id: 'db', label: 'Database', icon: Database, content: <DbTab /> },
//       { id: 'log', label: 'Logging', icon: ScrollText, content: <LogTab /> },
//     ]}
//     defaultTab="db"
//     footerActions={<Button>Save</Button>}
//   />
// ============================================================================
import React, { useState } from 'react';

export default function SettingsConfig({
  // Header
  title,
  subtitle,
  icon: HeaderIcon,
  headerActions,

  // Tabs
  tabs = [],
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,

  // Footer
  footerActions,
  footerLeft,

  // Styling
  className = '',
}) {
  const [internalTab, setInternalTab] = useState(defaultTab || tabs[0]?.id);
  const activeTabId = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const handleTabChange = (tabId) => {
    if (controlledActiveTab === undefined) setInternalTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  if (tabs.length === 0) return null;

  return (
    <div className={`flex flex-col h-full bg-white rounded-xl border border-surface-200/80 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      {(title || headerActions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-surface-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {HeaderIcon && (
              <div className="p-2 rounded-lg bg-gradient-to-br from-brand-50 to-teal-50">
                <HeaderIcon size={20} className="text-brand-600" />
              </div>
            )}
            <div>
              {title && <h2 className="text-base font-bold text-surface-800">{title}</h2>}
              {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      {/* Body: Tabs + Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Vertical Tab List */}
        <div className="w-52 flex-shrink-0 border-r border-surface-100 bg-surface-50/30 py-3 overflow-y-auto">
          <nav className="flex flex-col gap-0.5 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left
                    transition-all duration-150
                    ${isActive
                      ? 'bg-white text-brand-700 shadow-sm ring-1 ring-surface-200/60 font-semibold'
                      : 'text-surface-500 hover:text-surface-700 hover:bg-white/60'
                    }
                  `}
                >
                  {Icon && (
                    <Icon
                      size={16}
                      className={isActive ? 'text-brand-500' : 'text-surface-400'}
                    />
                  )}
                  <span className="text-sm truncate">{tab.label}</span>
                  {tab.badge && (
                    <span className={`
                      ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full
                      ${isActive ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400'}
                    `}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Active Tab Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab?.content}
        </div>
      </div>

      {/* Footer */}
      {(footerActions || footerLeft) && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-surface-100 bg-surface-50/30 flex-shrink-0">
          <div>{footerLeft}</div>
          <div className="flex items-center gap-2">{footerActions}</div>
        </div>
      )}
    </div>
  );
}
