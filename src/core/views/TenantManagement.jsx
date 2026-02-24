// ============================================================================
// TenantManagement — Full CRUD for platform tenants.
//
// ARCHITECTURE NOTE:
// Lives under core/ (not modules/) because tenants are a platform-level
// concern. Modules are tenant-scoped features; tenants are the foundation.
//
// Features:
//   - View all tenants in a table
//   - Create new tenant (modal form)
//   - Edit tenant (modal form)
//   - Delete tenant (confirmation)
//   - Status badges, plan indicators
//
// Uses shared components: Card, Button, ActionModal, PageHeader, etc.
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Search, Edit3, Trash2, X,
  AlertTriangle, Package, RefreshCw
} from 'lucide-react';
import { Card, Button, PageHeader, ActionModal, EmptyState, Logger, PlatformService, CreateTenantForm } from '@shared';

const PLANS = [
  { value: 'free', label: 'Free', color: 'bg-surface-100 text-surface-600' },
  { value: 'starter', label: 'Starter', color: 'bg-blue-50 text-blue-600' },
  { value: 'professional', label: 'Professional', color: 'bg-violet-50 text-violet-600' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-amber-50 text-amber-700' },
];

const STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-emerald-50 text-emerald-600' },
  { value: 'trial', label: 'Trial', color: 'bg-blue-50 text-blue-600' },
  { value: 'suspended', label: 'Suspended', color: 'bg-rose-50 text-rose-600' },
];

export default function TenantManagement({ isDatabaseReady }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [deletingTenant, setDeletingTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTenants = useCallback(async () => {
    if (!isDatabaseReady) return;
    setLoading(true);
    try {
      const data = await PlatformService.getTenants();
      setTenants(data);
      Logger.info('Tenants', `Loaded ${data.length} tenants`);
    } catch (err) {
      Logger.error('Tenants', 'Failed to load tenants', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [isDatabaseReady]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const filteredTenants = tenants.filter((t) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.tenantId?.toLowerCase().includes(q) ||
      t.metadata?.contactEmail?.toLowerCase().includes(q) ||
      t.plan?.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditingTenant(null);
    setIsFormOpen(true);
  };

  const openEdit = (tenant) => {
    setEditingTenant(tenant);
    setIsFormOpen(true);
  };

  const openDelete = (tenant) => {
    setDeletingTenant(tenant);
    setIsDeleteOpen(true);
  };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editingTenant) {
        await PlatformService.updateTenant(editingTenant.id, formData);
        Logger.info('Tenants', `Updated tenant: ${formData.name}`, { tenantId: editingTenant.id });
      } else {
        await PlatformService.createTenant(formData);
        Logger.info('Tenants', `Created tenant: ${formData.name}`, { tenantId: formData.tenantId });
      }
      setIsFormOpen(false);
      await loadTenants();
    } catch (err) {
      Logger.error('Tenants', `Failed to ${editingTenant ? 'update' : 'create'} tenant`, { error: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTenant) return;
    setDeleting(true);
    try {
      await PlatformService.deleteTenant(deletingTenant.id);
      Logger.info('Tenants', `Deleted tenant: ${deletingTenant.name}`, { tenantId: deletingTenant.id });
      setIsDeleteOpen(false);
      setDeletingTenant(null);
      await loadTenants();
    } catch (err) {
      Logger.error('Tenants', 'Failed to delete tenant', { error: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const getPlanBadge = (plan) => PLANS.find((p) => p.value === plan) || PLANS[0];
  const getStatusBadge = (status) => STATUSES.find((s) => s.value === status) || STATUSES[0];

  // Not connected
  if (!isDatabaseReady) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Tenant Management" subtitle="Manage organizations and subscriptions" icon={Building2} />
        <EmptyState
          icon={<AlertTriangle size={40} className="text-amber-400" />}
          title="Database not initialized"
          description="Please run the Database Setup Wizard before managing tenants."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title="Tenant Management" subtitle={`${tenants.length} organization${tenants.length !== 1 ? 's' : ''}`} icon={Building2} />

      {/* Toolbar */}
      <Card variant="flat" className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={loadTenants}
              className="p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <Button icon={<Plus size={14} />} onClick={openCreate}>
              Create Tenant
            </Button>
          </div>
        </div>
      </Card>

      {/* Tenant Table */}
      <Card variant="elevated" className="overflow-hidden">
        {filteredTenants.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={<Building2 size={40} className="text-surface-300" />}
              title={searchText ? 'No tenants match your search' : 'No tenants yet'}
              description={searchText ? 'Try adjusting your search terms.' : 'Create your first tenant to start onboarding organizations.'}
              action={!searchText && <Button icon={<Plus size={14} />} onClick={openCreate}>Create Tenant</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-50/80">
                <tr className="border-b border-surface-200">
                  <th className="text-left px-4 py-3 font-semibold text-surface-500">Tenant</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-20">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-24">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-20">Modules</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-28">Contact</th>
                  <th className="text-right px-4 py-3 font-semibold text-surface-500 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant) => {
                  const plan = getPlanBadge(tenant.plan);
                  const status = getStatusBadge(tenant.status);
                  return (
                    <tr key={tenant.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-surface-800">{tenant.name || '—'}</p>
                          <p className="text-[10px] font-mono text-surface-400 mt-0.5">{tenant.tenantId || tenant.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${plan.color}`}>
                          {plan.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-surface-400" />
                          {tenant.subscribedModules?.length || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[10px] text-surface-500 truncate max-w-[120px]">
                          {tenant.metadata?.contactEmail || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(tenant)}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => openDelete(tenant)}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal — uses shared CreateTenantForm, variant=custom (no auto footer) */}
      <ActionModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTenant ? 'Edit Tenant' : 'Create Tenant'}
        icon={Building2}
        size="xl"
        variant="custom"
      >
        <CreateTenantForm
          mode="admin"
          initialData={editingTenant}
          isEditing={!!editingTenant}
          onSubmit={handleSave}
          onCancel={() => setIsFormOpen(false)}
          isLoading={saving}
        />
      </ActionModal>

      {/* Delete Confirmation — uses variant=confirm for single set of buttons */}
      <ActionModal
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeletingTenant(null); }}
        title="Delete Tenant"
        icon={AlertTriangle}
        size="sm"
        variant="confirm"
        confirmLabel="Delete Tenant"
        confirmVariant="danger"
        onConfirm={handleDelete}
        isProcessing={deleting}
      >
        <div className="py-2">
          <p className="text-sm text-surface-600">
            Are you sure you want to delete <strong className="text-surface-800">{deletingTenant?.name}</strong>?
          </p>
          <p className="text-xs text-rose-500 mt-2">
            This action cannot be undone. All tenant data, users, and module subscriptions will be permanently removed.
          </p>
        </div>
      </ActionModal>
    </div>
  );
}
