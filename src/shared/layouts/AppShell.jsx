// ============================================================================
// AppShell — The master layout that composes the entire authenticated UI.
//
// ARCHITECTURE NOTE:
// This is the SINGLE layout wrapper for the entire app post-login.
// It composes: TopNav (top) + SideNav (left) + MainContent (center)
//              + RightPanel (slide-out, right).
//
// The AppShell is MODULE-AGNOSTIC. It receives:
//   - modules[]        → for TopNav module tabs
//   - sideNavItems[]   → for SideNav (provided by the active module)
//   - children         → the active module's page content
//
// Structure:
//   ┌──────────────────────────────────────────────────┐
//   │              TopNav (fixed)              [📊] [👤]│
//   ├────────┬────────────────────────┬───────────────┤
//   │        │                        │  RightPanel   │
//   │ SideNav│     Main Content       │  (slide-out)  │
//   │  (◀▶)  │     (children)         │  Logs|API|Bug │
//   │        │                        │               │
//   └────────┴────────────────────────┴───────────────┘
// ============================================================================
import React, { useState } from 'react';
import TopNav from './TopNav';
import SideNav from './SideNav';
import RightPanel from './RightPanel';

export default function AppShell({
  // TopNav props
  appName,
  modules = [],
  activeModuleId,
  onSwitchModule,
  onOpenSettings,
  onLogout,
  onLogin,
  onRegister,
  onSystemAdmin,
  user,

  // SideNav props
  sideNavTitle,
  sideNavItems = [],
  activeSideNavItemId,
  onSelectSideNavItem,
  sideNavCollapsed: controlledCollapsed,
  onToggleSideNav: controlledToggle,

  // Content
  children,
}) {
  const hasSideNav = sideNavItems.length > 0;

  // Internal SideNav collapse state (used if parent doesn't control it)
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const sideNavCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const onToggleSideNav = controlledToggle || (() => setInternalCollapsed((c) => !c));

  // RightPanel state
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-surface-50 font-sans text-surface-800">
      {/* Top Navigation — always visible */}
      <TopNav
        appName={appName}
        modules={modules}
        activeModuleId={activeModuleId}
        onSwitchModule={onSwitchModule}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        onLogin={onLogin}
        onRegister={onRegister}
        onSystemAdmin={onSystemAdmin}
        user={user}
        onToggleRightPanel={() => setIsRightPanelOpen((o) => !o)}
        isRightPanelOpen={isRightPanelOpen}
      />

      {/* Body: SideNav + Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar — collapsible */}
        {hasSideNav && (
          <SideNav
            title={sideNavTitle}
            items={sideNavItems}
            activeItemId={activeSideNavItemId}
            onSelectItem={onSelectSideNavItem}
            collapsed={sideNavCollapsed}
            onToggleCollapse={onToggleSideNav}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Right Panel — slide-out observability panel */}
      <RightPanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
      />
    </div>
  );
}
