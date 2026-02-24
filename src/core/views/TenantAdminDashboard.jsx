// ============================================================================
// TenantAdminDashboard — The main view for authenticated tenant users.
//
// ARCHITECTURE NOTE:
// TenantAdmin users see: Dashboard overview, User Management, Settings.
// TenantUser users see: Dashboard overview only (no admin menu).
// The left nav is role-driven. Modules will be added as they are built.
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, Settings, Building2, Plus,
  UserPlus, Search, Edit3, Trash2, AlertTriangle,
  CheckCircle2, XCircle, Shield, Layers, Eye, EyeOff,
  Crown, User as UserIcon, RefreshCw
} from 'lucide-react';
import { AppShell, Card, PageHeader, Button, EmptyState, ActionModal, Logger, UserService } from '@shared';
import messages from '@config/messages.json';
import appConfig from '@config/app.json';

// --- Nav items by role ---
const ADMIN_NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'users',     label: 'User Management', icon: Users },
  { id: 'settings',  label: 'Settings', icon: Settings },
];

const USER_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const FREE_TIER_MAX_USERS = messages.tenant.tiers.free.maxUsers;

export default function TenantAdminDashboard({ user, onLogout, appName }) {
  const [activeView, setActiveView] = useState('dashboard');
  const isTenantAdmin = user?.role === 'tenant_admin' || user?.role === 'tenant_owner';
  const navItems = isTenantAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <AppShell
      appName={appName}
      modules={[]}
      activeModuleId={null}
      onSwitchModule={() => {}}
      onLogout={onLogout}
      user={user}
      sideNavTitle={isTenantAdmin ? 'Tenant Admin' : 'Tenant'}
      sideNavItems={navItems}
      activeSideNavItemId={activeView}
      onSelectSideNavItem={setActiveView}
    >
      {activeView === 'dashboard' && <DashboardView user={user} onNavigate={setActiveView} />}
      {activeView === 'users' && isTenantAdmin && <UserManagementView user={user} />}
      {activeView === 'settings' && isTenantAdmin && <TenantSettingsView user={user} />}
    </AppShell>
  );
}

// --- Dashboard Overview ---
function DashboardView({ user, onNavigate }) {
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isTenantAdmin = user?.role === 'tenant_admin' || user?.role === 'tenant_owner';
  const tenantId = user?.tenantId;

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    UserService.getTenantUserCount(tenantId).then(c => { setUserCount(c); setLoading(false); }).catch(() => setLoading(false));
  }, [tenantId]);

  const modules = appConfig.availableModules || [];

  return (
    <div className="animate-fade-in space-y-0">
      <PageHeader
        title="Tenant Admin - Overview"
        subtitle={`${messages.dashboard.tenantAdmin.welcome.replace('{name}', user?.displayName || 'User')} · ${user?.email || ''}`}
        icon={LayoutDashboard}
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <TileStat
          icon={<Users size={20} className="text-brand-500" />}
          label="Team Members"
          value={loading ? '...' : String(userCount)}
          detail={`of ${FREE_TIER_MAX_USERS} (Free Tier)`}
          gradient="from-brand-50 to-blue-50"
          actionLabel={isTenantAdmin ? 'Manage' : null}
          onAction={() => onNavigate('users')}
        />
        <TileStat
          icon={<Building2 size={20} className="text-violet-500" />}
          label="Organization"
          value={user?.tenantId ? '1' : '0'}
          detail={user?.tenantId || 'No tenant'}
          gradient="from-violet-50 to-purple-50"
        />
        <TileStat
          icon={<Shield size={20} className="text-amber-500" />}
          label="Your Role"
          value={messages.users.roles[user?.role] || user?.role || '—'}
          detail={isTenantAdmin ? 'Full admin access' : 'Standard access'}
          gradient="from-amber-50 to-orange-50"
        />
        <TileStat
          icon={<Layers size={20} className="text-emerald-500" />}
          label="Plan"
          value="Free"
          detail={messages.tenant.tiers.free.description}
          gradient="from-emerald-50 to-teal-50"
        />
      </div>

      {/* Separator */}
      <div className="py-6">
        <div className="h-1 bg-gradient-to-r from-transparent via-brand-300/80 to-transparent rounded-full" />
      </div>

      {/* Licensed Modules */}
      <div>
        <h3 className="text-sm font-bold text-surface-700 mb-4 flex items-center gap-2">
          <Layers size={15} className="text-brand-500" />
          {messages.dashboard.tenantAdmin.licensedModules}
        </h3>
        {modules.length === 0 ? (
          <Card variant="flat" className="p-8 text-center">
            <p className="text-sm text-surface-400">{messages.dashboard.tenantAdmin.noModulesYet}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <Card key={mod.id} variant="elevated" className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-brand-50 to-teal-50">
                    <Layers size={18} className="text-brand-600" />
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-surface-100 text-surface-400">
                    Coming Soon
                  </span>
                </div>
                <h4 className="text-sm font-bold text-surface-800">{mod.name}</h4>
                <p className="text-xs text-surface-400 mt-1 mb-3">{mod.description}</p>
                <p className="text-[10px] text-surface-300 font-mono">v{mod.version}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- User Management (TenantAdmin only) ---
function UserManagementView({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ displayName: '', email: '', password: '', phone: '', role: 'tenant_user' });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const tenantId = user?.tenantId;

  const loadUsers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const result = await UserService.getUsersByTenant(tenantId);
      setUsers(result);
    } catch (err) {
      Logger.error('TenantAdmin', 'Failed to load users', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filteredUsers = users.filter(u => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    setError('');
    // Validations
    if (!formData.displayName.trim()) { setError(messages.auth.errors.nameRequired); return; }
    if (!formData.email.trim()) { setError(messages.auth.errors.emailRequired); return; }
    const emailRegex = new RegExp(messages.validation.emailRegex);
    if (!emailRegex.test(formData.email)) { setError(messages.auth.errors.emailInvalid); return; }
    if (formData.password.length < messages.validation.minPasswordLength) { setError(messages.auth.errors.weakPassword); return; }
    const nameRegex = new RegExp(messages.validation.nameRegex);
    if (!nameRegex.test(formData.displayName)) { setError(messages.auth.errors.nameInvalid); return; }

    setSaving(true);
    try {
      await UserService.createTenantUser(formData, tenantId, FREE_TIER_MAX_USERS);
      setIsCreateOpen(false);
      setFormData({ displayName: '', email: '', password: '', phone: '', role: 'tenant_user' });
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    try {
      await UserService.deleteUser(selectedUser.id);
      setIsDeleteOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const canCreateMore = users.length < FREE_TIER_MAX_USERS;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Tenant Admin - User Management" subtitle={`${users.length} of ${FREE_TIER_MAX_USERS} users (Free Tier)`} icon={Users} />

      {/* Toolbar */}
      <Card variant="flat" className="p-3 mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<UserPlus size={14} />}
          onClick={() => { setError(''); setFormData({ displayName: '', email: '', password: '', phone: '', role: 'tenant_user' }); setIsCreateOpen(true); }}
          disabled={!canCreateMore}
        >
          Add User
        </Button>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={loadUsers} disabled={loading}>
          Refresh
        </Button>
      </Card>

      {!canCreateMore && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertTriangle size={16} />
          <span>{messages.users.errors.maxUsersReached.replace('{maxUsers}', String(FREE_TIER_MAX_USERS))}</span>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <Card variant="flat" className="p-12 text-center"><RefreshCw size={20} className="animate-spin mx-auto text-surface-300" /></Card>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users size={40} className="text-surface-300" />}
          title="No users yet"
          description="Add team members to your organization."
        />
      ) : (
        <Card variant="flat" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-surface-500">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-500">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-500">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-surface-500">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-surface-500 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isOwner = u.role === 'tenant_owner' || u.role === 'tenant_admin';
                return (
                  <tr key={u.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{(u.displayName || 'U').charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-surface-800">{u.displayName}</span>
                        {isOwner && <Crown size={12} className="text-amber-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-surface-500 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isOwner ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'
                      }`}>
                        {messages.users.roles[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        u.status === 'active' ? 'text-emerald-600' : 'text-surface-400'
                      }`}>
                        {u.status === 'active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isOwner && (
                        <button
                          onClick={() => { setSelectedUser(u); setIsDeleteOpen(true); }}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create User Modal */}
      <ActionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Team Member"
        icon={UserPlus}
        size="md"
        variant="custom"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">Full Name <span className="text-rose-400">*</span></label>
            <input type="text" value={formData.displayName} onChange={(e) => setFormData(p => ({ ...p, displayName: e.target.value }))}
              placeholder="John Doe"
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">Email <span className="text-rose-400">*</span></label>
            <input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="user@company.com"
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">Password <span className="text-rose-400">*</span></label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={formData.password}
                onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 pr-10 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">Phone (optional)</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
              placeholder="+1 (555) 123-4567"
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-600 mb-1">Role</label>
            <select value={formData.role} onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all">
              <option value="tenant_user">Tenant User</option>
            </select>
            <p className="text-[10px] text-surface-400 mt-1">Only Tenant User role can be assigned. Each tenant has exactly 1 admin.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={saving} icon={<UserPlus size={15} />}>
              Create User
            </Button>
          </div>
        </div>
      </ActionModal>

      {/* Delete Confirmation */}
      <ActionModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete User"
        icon={AlertTriangle}
        size="sm"
        variant="confirm"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
        isProcessing={deleting}
      >
        <p className="text-sm text-surface-600">
          Are you sure you want to delete <strong>{selectedUser?.displayName}</strong> ({selectedUser?.email})?
          This action cannot be undone.
        </p>
      </ActionModal>
    </div>
  );
}

// --- Tenant Settings (placeholder) ---
function TenantSettingsView({ user }) {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Tenant Admin - Settings" subtitle="Manage your organization settings" icon={Settings} />
      <Card variant="flat" className="p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-surface-500">Tenant ID</span>
            <span className="text-xs font-mono font-semibold text-surface-700">{user?.tenantId || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-surface-500">Plan</span>
            <span className="text-xs font-semibold text-emerald-600">Free Tier</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-surface-500">Max Users</span>
            <span className="text-xs font-semibold text-surface-700">{FREE_TIER_MAX_USERS}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-surface-500">Admin Email</span>
            <span className="text-xs font-mono font-semibold text-surface-700">{user?.email || '—'}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Local sub-component ---
function TileStat({ icon, label, value, detail, gradient, actionLabel, onAction }) {
  return (
    <div className="relative rounded-xl overflow-hidden shadow-md">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-300 to-teal-300" />
      <div className={`p-4 pl-5 bg-gradient-to-br ${gradient} border border-surface-200/60 rounded-xl flex flex-col h-full`}>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-white/80 shadow-sm">{icon}</div>
          {actionLabel && (
            <button
              onClick={onAction}
              className="text-[10px] font-bold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-0.5 rounded-md transition-colors"
            >
              {actionLabel} →
            </button>
          )}
        </div>
        <p className="text-xl font-extrabold text-surface-800 mb-1">{value}</p>
        <p className="text-xs font-semibold text-surface-600">{label}</p>
        {detail && <p className="text-[10px] text-surface-500 mt-1 flex-grow">{detail}</p>}
      </div>
    </div>
  );
}
