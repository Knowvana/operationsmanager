// ============================================================================
// TopNav — Global top navigation bar.
//
// ARCHITECTURE NOTE:
// This component is ALWAYS visible when a user is authenticated.
// It receives module list and active module from the parent AppShell.
// It never imports module-specific code — it's purely data-driven.
//
// Structure: [Brand Logo] [Module Tabs] ............. [Settings] [User Menu]
// ============================================================================
import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, ChevronDown, User, MonitorDot, Shield } from 'lucide-react';

export default function TopNav({
  appName = 'Operations Manager',
  modules = [],
  activeModuleId,
  onSwitchModule,
  onOpenSettings,
  onLogout,
  user,
  onToggleRightPanel,
  isRightPanelOpen = false,
}) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const adminMenuRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setIsAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Accent gradient line at very top */}
      <div className="h-0.5 w-full bg-gradient-to-r from-brand-400 via-teal-400 to-emerald-400" />

      <header className="bg-white/90 backdrop-blur-2xl border-b border-surface-200/80 sticky top-0 z-[60] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="w-full px-4 h-14 flex items-center justify-between">

          {/* Left: Brand + Module Tabs */}
          <div className="flex items-center gap-8">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center shadow-sm shadow-brand-200">
                <span className="text-white text-sm font-extrabold">O</span>
              </div>
              <span className="text-sm font-bold text-surface-800 hidden sm:block">{appName}</span>
            </div>

            {/* System Admin Menu — formal dropdown for system admins */}
            {user?.isSystemAdmin && (
              <div className="relative" ref={adminMenuRef}>
                <button
                  onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
                    transition-all duration-200 border
                    ${isAdminMenuOpen
                      ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                      : 'text-surface-600 border-transparent hover:bg-surface-50 hover:border-surface-200'
                    }
                  `}
                >
                  <Shield size={14} className={isAdminMenuOpen ? 'text-amber-600' : 'text-surface-400'} />
                  <span className="hidden sm:inline">System Admin</span>
                  <ChevronDown size={13} className={`transition-transform ${isAdminMenuOpen ? 'rotate-180 text-amber-500' : 'text-surface-400'}`} />
                </button>

                {isAdminMenuOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-surface-200 shadow-xl shadow-surface-200/50 py-1.5 animate-slide-up z-50">
                    <div className="px-3 py-2 border-b border-surface-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Administration</p>
                    </div>
                    <button
                      onClick={() => { setIsAdminMenuOpen(false); onOpenSettings?.(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                    >
                      <Settings size={14} className="text-surface-400" />
                      Platform Settings
                    </button>
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-surface-400 cursor-default"
                      disabled
                    >
                      <Shield size={14} />
                      Access Control
                      <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-400">Soon</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-surface-400 cursor-default"
                      disabled
                    >
                      <User size={14} />
                      Audit Log
                      <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-400">Soon</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Module Tabs */}
            {modules.length > 0 && (
              <nav className="flex items-center gap-1">
                {modules.map((mod) => {
                  const Icon = mod.icon;
                  const isActive = mod.id === activeModuleId;
                  return (
                    <button
                      key={mod.id}
                      onClick={() => onSwitchModule(mod.id)}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                        transition-all duration-200
                        ${isActive
                          ? 'bg-brand-50 text-brand-700 shadow-sm'
                          : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'
                        }
                      `}
                    >
                      {Icon && <Icon size={15} />}
                      <span className="hidden md:inline">{mod.name}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right: Settings + User + Monitor */}
          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
                title="Global Settings"
              >
                <Settings size={18} />
              </button>
            )}

            {/* User Menu */}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-teal-400 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-surface-700 hidden lg:block max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                  <ChevronDown size={14} className={`text-surface-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-surface-200 shadow-xl shadow-surface-200/50 py-1.5 animate-slide-up z-50">
                    <div className="px-4 py-2.5 border-b border-surface-100">
                      <p className="text-sm font-semibold text-surface-800 truncate">{user.displayName || 'User'}</p>
                      <p className="text-xs text-surface-400 truncate">{user.email}</p>
                      {user.role && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-brand-50 text-brand-600">
                          {user.role.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { setIsUserMenuOpen(false); onLogout?.(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* System Monitor — rightmost, after user avatar */}
            {onToggleRightPanel && (
              <div className="pl-1 ml-1 border-l border-surface-200">
                <button
                  onClick={onToggleRightPanel}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                    transition-all duration-200
                    ${isRightPanelOpen
                      ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200'
                      : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100'
                    }
                  `}
                  title="System Monitor — Logs, API Calls, Report Issue"
                >
                  <MonitorDot size={16} />
                  <span className="hidden md:inline">Monitor</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
