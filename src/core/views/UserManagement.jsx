// ============================================================================
// UserManagement — Full CRUD for platform users.
//
// ARCHITECTURE NOTE:
// Lives under core/ (not modules/) because users are a platform-level
// concern. Shows all platform users with CRUD capabilities.
//
// Features:
//   - View all users in a table
//   - System Admin shown as a separate tile at top
//   - Other users shown in grid below with CRUD
//   - Create new user (modal form)
//   - Edit user (modal form)
//   - Delete user (confirmation)
//   - Status badges, role indicators
//
// Uses shared components: Card, Button, ActionModal, PageHeader, etc.
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Plus, Search, Edit3, Trash2, X,
  AlertTriangle, Shield, RefreshCw, Mail, Calendar
} from 'lucide-react';
import { Card, Button, PageHeader, ActionModal, EmptyState, Logger, UserService } from '@shared';

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

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    const lower = searchText.toLowerCase();
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(lower) ||
      (u.displayName || '').toLowerCase().includes(lower)
    );
  }, [users, searchText]);

  const systemAdmin = useMemo(() => filteredUsers.find(u => u.role === 'system_admin'), [filteredUsers]);
  const otherUsers = useMemo(() => filteredUsers.filter(u => u.role !== 'system_admin'), [filteredUsers]);

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await UserService.deleteUser(deletingUser.id);
      setUsers(users.filter(u => u.id !== deletingUser.id));
      setIsDeleteOpen(false);
      setDeletingUser(null);
      Logger.info('Platform Admin - Users', 'User deleted', { userId: deletingUser.id, email: deletingUser.email });
    } catch (err) {
      Logger.error('Platform Admin - Users', 'Failed to delete user', { error: err.message });
      alert('Failed to delete user: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }, [deletingUser, users]);

  const getRoleConfig = (role) => ROLES.find(r => r.value === role) || ROLES[2];
  const getStatusConfig = (status) => STATUSES.find(s => s.value === status) || STATUSES[0];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Platform Admin - Users"
        subtitle="Manage all platform users and access"
        icon={Users}
      />

      {/* Toolbar */}
      <Card variant="flat" className="p-4 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              <X size={14} />
            </button>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => { setEditingUser(null); setIsFormOpen(true); }}
        >
          New User
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={loadUsers}
          disabled={loading}
        />
      </Card>

      {/* System Admin Tile */}
      {systemAdmin && (
        <>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">System Administrator</h3>
            <Card variant="flat" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-bold text-surface-800">{systemAdmin.displayName || '—'}</h4>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getRoleConfig(systemAdmin.role).color}`}>
                      {getRoleConfig(systemAdmin.role).label}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getStatusConfig(systemAdmin.status).color}`}>
                      {getStatusConfig(systemAdmin.status).label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-surface-500">
                    <div className="flex items-center gap-1">
                      <Mail size={12} />
                      {systemAdmin.email}
                    </div>
                    {systemAdmin.createdAt && (
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(systemAdmin.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={<Edit3 size={12} />}
                    onClick={() => { setEditingUser(systemAdmin); setIsFormOpen(true); }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Separator */}
          {otherUsers.length > 0 && <div className="border-t border-surface-100" />}
        </>
      )}

      {/* Other Users Grid */}
      {otherUsers.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Other Users ({otherUsers.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherUsers.map((user) => (
              <Card key={user.id} variant="flat" className="p-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-surface-800 mb-1">{user.displayName || '—'}</h4>
                    <p className="text-xs text-surface-500 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getRoleConfig(user.role).color}`}>
                      {getRoleConfig(user.role).label}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getStatusConfig(user.status).color}`}>
                      {getStatusConfig(user.status).label}
                    </span>
                  </div>
                  {user.createdAt && (
                    <p className="text-[10px] text-surface-400">
                      Created {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={<Edit3 size={12} />}
                      onClick={() => { setEditingUser(user); setIsFormOpen(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={<Trash2 size={12} />}
                      onClick={() => { setDeletingUser(user); setIsDeleteOpen(true); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <EmptyState
          icon={<Users size={40} className="text-surface-300" />}
          title="No users found"
          description={searchText ? 'Try adjusting your search' : 'Create your first user to get started'}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ActionModal
        isOpen={isDeleteOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${deletingUser?.displayName || deletingUser?.email}? This action cannot be undone.`}
        variant="confirm"
        confirmLabel="Delete"
        confirmVariant="danger"
        isProcessing={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setIsDeleteOpen(false); setDeletingUser(null); }}
      />
    </div>
  );
}
