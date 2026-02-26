// ============================================================================
// UserManagement — Platform user management with left menu + grid layout.
//
// ARCHITECTURE NOTE:
// Left menu: Admin Users | Tenant Users
// Grid: Shows users in card grid with role/status badges
// Admin Users: View only (no edit/delete)
// Tenant Users: Full CRUD (edit/delete)
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Plus, Search, Edit3, Trash2, X, Eye,
  Shield, RefreshCw, Mail, Calendar, UserCheck
} from 'lucide-react';
import { Card, Button, PageHeader, ActionModal, EmptyState, Logger, UserService } from '@shared';
import messages from '@config/messages.json';

const ROLES = [
  { value: 'system_admin', label: 'System Admin', color: 'bg-rose-50 text-rose-600' },
  { value: 'tenant_admin', label: 'Tenant Admin', color: 'bg-violet-50 text-violet-600' },
  { value: 'tenant_user', label: 'Tenant User', color: 'bg-blue-50 text-blue-600' },
];

const STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-emerald-50 text-emerald-600' },
  { value: 'inactive', label: 'Inactive', color: 'bg-surface-50 text-surface-600' },
  { value: 'suspended', label: 'Suspended', color: 'bg-rose-50 text-rose-600' },
];

const MENU_ITEMS = [
  { id: 'admin', label: messages.platformAdmin.users.adminUsers, icon: Shield },
  { id: 'tenant', label: messages.platformAdmin.users.tenantUsers, icon: UserCheck },
];

function getRoleConfig(role) { return ROLES.find(r => r.value === role) || ROLES[2]; }
function getStatusConfig(status) { return STATUSES.find(s => s.value === status) || STATUSES[0]; }

// Reusable user card component
function UserCard({ user, readOnly = false, onEdit, onDelete }) {
  const role = getRoleConfig(user.role);
  const status = getStatusConfig(user.status);
  return (
    <Card variant="flat" className="p-4">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-surface-800 mb-1">{user.displayName || '—'}</h4>
          <div className="flex items-center gap-1 text-xs text-surface-500">
            <Mail size={11} />
            <span className="truncate">{user.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${role.color}`}>{role.label}</span>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${status.color}`}>{status.label}</span>
        </div>
        {user.createdAt && (
          <div className="flex items-center gap-1 text-[10px] text-surface-400">
            <Calendar size={10} />
            Created {new Date(user.createdAt).toLocaleDateString()}
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
          {readOnly ? (
            <Button variant="ghost" size="xs" icon={<Eye size={12} />}>{messages.platformAdmin.users.viewOnly}</Button>
          ) : (
            <>
              <Button variant="secondary" size="xs" icon={<Edit3 size={12} />} onClick={() => onEdit?.(user)}>Edit</Button>
              <Button variant="ghost" size="xs" icon={<Trash2 size={12} />} onClick={() => onDelete?.(user)}>Delete</Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function UserManagement() {
  const [activeMenu, setActiveMenu] = useState('admin');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const allUsers = await UserService.getAllUsers();
      setUsers(allUsers || []);
      Logger.info('Platform Admin - Users', 'Users loaded', { count: allUsers?.length || 0 });
    } catch (err) {
      Logger.error('Platform Admin - Users', 'Failed to load users', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const adminUsers = useMemo(() => users.filter(u => u.role === 'system_admin'), [users]);
  const tenantUsers = useMemo(() => users.filter(u => u.role !== 'system_admin'), [users]);
  const currentList = activeMenu === 'admin' ? adminUsers : tenantUsers;

  const filteredUsers = useMemo(() => {
    if (!searchText) return currentList;
    const q = searchText.toLowerCase();
    return currentList.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    );
  }, [currentList, searchText]);

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await UserService.deleteUser(deletingUser.id);
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
      setIsDeleteOpen(false);
      setDeletingUser(null);
      Logger.info('Platform Admin - Users', 'User deleted', { userId: deletingUser.id });
    } catch (err) {
      Logger.error('Platform Admin - Users', 'Failed to delete user', { error: err.message });
    } finally {
      setDeleting(false);
    }
  }, [deletingUser]);

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={messages.platformAdmin.users.title} subtitle={messages.platformAdmin.users.subtitle} icon={Users} />

      <div className="flex gap-4">
        {/* Left Menu */}
        <div className="w-48 flex-shrink-0">
          <Card variant="flat" className="p-2">
            {MENU_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              const count = item.id === 'admin' ? adminUsers.length : tenantUsers.length;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveMenu(item.id); setSearchText(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all mb-1 ${
                    isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
                  }`}
                >
                  <Icon size={14} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-400'}`}>{count}</span>
                </button>
              );
            })}
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Toolbar */}
          <Card variant="flat" className="p-3 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder={`Search ${activeMenu === 'admin' ? 'admin' : 'tenant'} users...`}
                className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              {searchText && (
                <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"><X size={14} /></button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeMenu === 'tenant' && (
                <Button variant="primary" size="sm" icon={<Plus size={14} />}>New User</Button>
              )}
              <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={loadUsers} disabled={loading} />
            </div>
          </Card>

          {/* User Grid */}
          {filteredUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  readOnly={activeMenu === 'admin'}
                  onEdit={() => {}}
                  onDelete={(u) => { setDeletingUser(u); setIsDeleteOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users size={40} className="text-surface-300" />}
              title={searchText ? 'No users match your search' : `No ${activeMenu === 'admin' ? 'admin' : 'tenant'} users found`}
              description={searchText ? 'Try adjusting your search terms' : activeMenu === 'tenant' ? 'Create a user to get started' : 'System admin accounts appear here'}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ActionModal
        isOpen={isDeleteOpen}
        title={messages.platformAdmin.users.deleteTitle}
        variant="confirm"
        confirmLabel="Delete"
        confirmVariant="danger"
        isProcessing={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setIsDeleteOpen(false); setDeletingUser(null); }}
      >
        <p className="text-sm text-surface-600">Are you sure you want to delete <strong>{deletingUser?.displayName || deletingUser?.email}</strong>? This action cannot be undone.</p>
      </ActionModal>
    </div>
  );
}
