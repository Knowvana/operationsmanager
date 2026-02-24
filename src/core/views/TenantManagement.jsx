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
  CheckCircle2, AlertTriangle, Clock, Users,
  Package, Mail, Phone, Globe, RefreshCw
} from 'lucide-react';
import { Card, Button, PageHeader, ActionModal, Input, EmptyState, Logger, PlatformService } from '@shared';

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

const AVAILABLE_MODULES = [
  { id: 'ops_monitor', name: 'Operations Monitor' },
  { id: 'shift_roster', name: 'Shift Roster Planner' },
];

const EMPTY_FORM = {
  name: '',
  tenantId: '',
  status: 'trial',
  plan: 'free',
  maxUsers: 5,
  subscribedModules: [],
  metadata: { industry: '', contactEmail: '', contactPhone: '' },
};

export default function TenantManagement({ isDatabaseReady }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [deletingTenant, setDeletingTenant] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
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
    setFormData({ ...EMPTY_FORM, tenantId: `tenant_${Date.now()}` });
    setIsFormOpen(true);
  };

  const openEdit = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name || '',
      tenantId: tenant.tenantId || tenant.id,
      status: tenant.status || 'trial',
      plan: tenant.plan || 'free',
      maxUsers: tenant.maxUsers || 5,
      subscribedModules: tenant.subscribedModules || [],
      metadata: {
        industry: tenant.metadata?.industry || '',
        contactEmail: tenant.metadata?.contactEmail || '',
        contactPhone: tenant.metadata?.contactPhone || '',
      },
    });
    setIsFormOpen(true);
  };

  const openDelete = (tenant) => {
    setDeletingTenant(tenant);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
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

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateMetadata = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  };

  const toggleModule = (moduleId) => {
    setFormData((prev) => {
      const mods = prev.subscribedModules.includes(moduleId)
        ? prev.subscribedModules.filter((m) => m !== moduleId)
        : [...prev.subscribedModules, moduleId];
      return { ...prev, subscribedModules: mods };
    });
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
                  <th className="text-left px-4 py-3 font-semibold text-surface-500">Organization</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-20">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-24">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-500 w-16">Users</th>
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
                          <Users size={12} className="text-surface-400" />
                          {tenant.maxUsers || 0}
                        </div>
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

      {/* Create/Edit Modal */}
      <ActionModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTenant ? 'Edit Tenant' : 'Create Tenant'}
        icon={Building2}
        size="lg"
      >
        <div className="space-y-5 py-2">
          {/* Basic Info */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Organization Details</h4>
            <div className="space-y-3">
              <FormField label="Organization Name" required>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
                />
              </FormField>
              <FormField label="Tenant ID" hint="Auto-generated, can be customized">
                <input
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => updateForm('tenantId', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all font-mono"
                  disabled={!!editingTenant}
                />
              </FormField>
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent" />

          {/* Plan & Status */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Plan & Status</h4>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Status">
                <select
                  value={formData.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Plan">
                <select
                  value={formData.plan}
                  onChange={(e) => updateForm('plan', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                >
                  {PLANS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Max Users">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={formData.maxUsers}
                  onChange={(e) => updateForm('maxUsers', parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </FormField>
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent" />

          {/* Modules */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Module Subscriptions</h4>
            <div className="space-y-2">
              {AVAILABLE_MODULES.map((mod) => {
                const checked = formData.subscribedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left
                      ${checked
                        ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200'
                        : 'border-surface-200 bg-white hover:bg-surface-50'
                      }
                    `}
                  >
                    <div className={`
                      w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${checked ? 'bg-brand-500 border-brand-500' : 'border-surface-300'}
                    `}>
                      {checked && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-surface-700">{mod.name}</p>
                      <p className="text-[10px] text-surface-400 font-mono">{mod.id}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent" />

          {/* Contact Info */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Contact Information</h4>
            <div className="space-y-3">
              <FormField label="Industry">
                <input
                  type="text"
                  value={formData.metadata.industry}
                  onChange={(e) => updateMetadata('industry', e.target.value)}
                  placeholder="Technology, Healthcare, etc."
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </FormField>
              <FormField label="Contact Email">
                <input
                  type="email"
                  value={formData.metadata.contactEmail}
                  onChange={(e) => updateMetadata('contactEmail', e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </FormField>
              <FormField label="Contact Phone">
                <input
                  type="tel"
                  value={formData.metadata.contactPhone}
                  onChange={(e) => updateMetadata('contactPhone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-surface-100">
          <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
            disabled={!formData.name.trim()}
            icon={editingTenant ? <Edit3 size={14} /> : <Plus size={14} />}
          >
            {editingTenant ? 'Update Tenant' : 'Create Tenant'}
          </Button>
        </div>
      </ActionModal>

      {/* Delete Confirmation */}
      <ActionModal
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeletingTenant(null); }}
        title="Delete Tenant"
        icon={AlertTriangle}
        size="sm"
      >
        <div className="py-4">
          <p className="text-sm text-surface-600">
            Are you sure you want to delete <strong className="text-surface-800">{deletingTenant?.name}</strong>?
          </p>
          <p className="text-xs text-rose-500 mt-2">
            This action cannot be undone. All tenant data, users, and module subscriptions will be permanently removed.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
          <Button variant="secondary" onClick={() => { setIsDeleteOpen(false); setDeletingTenant(null); }}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleting}
            icon={<Trash2 size={14} />}
          >
            Delete Tenant
          </Button>
        </div>
      </ActionModal>
    </div>
  );
}

// --- Local sub-component ---
function FormField({ label, required, hint, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-surface-600 mb-1.5">
        {label}
        {required && <span className="text-rose-400">*</span>}
        {hint && <span className="text-[10px] text-surface-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
