// ============================================================================
// TenantManagement — Platform tenant management with left menu + grid layout.
//
// ARCHITECTURE NOTE:
// Left menu: All Tenants | Active | Trial | Suspended (status-based filter)
// Grid: Shows tenants in card grid with plan/status badges
// Full CRUD: Create, Edit, Delete tenants
// Pattern matches UserManagement for consistency.
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, Plus, Search, Edit3, Trash2, X,
  AlertTriangle, Package, RefreshCw, Mail, CheckCircle2,
  Clock, XCircle
} from 'lucide-react';
import { Card, Button, PageHeader, ActionModal, EmptyState, Logger, PlatformService, TenantForm } from '@shared';
import messages from '@config/messages.json';

const PLANS = [
  { value: 'free', label: 'Free', color: 'bg-surface-100 text-surface-600' },
  { value: 'starter', label: 'Starter', color: 'bg-blue-50 text-blue-600' },
  { value: 'professional', label: 'Professional', color: 'bg-violet-50 text-violet-600' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-amber-50 text-amber-700' },
];

const STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  { value: 'trial', label: 'Trial', color: 'bg-blue-50 text-blue-600', icon: Clock },
  { value: 'suspended', label: 'Suspended', color: 'bg-rose-50 text-rose-600', icon: XCircle },
];

const MENU_ITEMS = [
  { id: 'all', label: messages.platformAdmin.tenants.allTenants, icon: Building2 },
  { id: 'active', label: 'Active', icon: CheckCircle2 },
  { id: 'trial', label: 'Trial', icon: Clock },
  { id: 'suspended', label: 'Suspended', icon: XCircle },
];

function getPlanBadge(plan) { return PLANS.find(p => p.value === plan) || PLANS[0]; }
function getStatusBadge(status) { return STATUSES.find(s => s.value === status) || STATUSES[0]; }

// Reusable tenant card component
function TenantCard({ tenant, onEdit, onDelete }) {
  const plan = getPlanBadge(tenant.plan);
  const status = getStatusBadge(tenant.status);
  return (
    <Card variant="flat" className="p-4">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-surface-800 mb-1">{tenant.name || '—'}</h4>
          <p className="text-[10px] font-mono text-surface-400">{tenant.tenantId || tenant.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${status.color}`}>{status.label}</span>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${plan.color}`}>{plan.label}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-surface-400">
          {tenant.metadata?.contactEmail && (
            <div className="flex items-center gap-1 truncate"><Mail size={10} />{tenant.metadata.contactEmail}</div>
          )}
          <div className="flex items-center gap-1"><Package size={10} />{tenant.subscribedModules?.length || 0} modules</div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
          <Button variant="secondary" size="xs" icon={<Edit3 size={12} />} onClick={() => onEdit?.(tenant)}>Edit</Button>
          <Button variant="ghost" size="xs" icon={<Trash2 size={12} />} onClick={() => onDelete?.(tenant)}>Delete</Button>
        </div>
      </div>
    </Card>
  );
}

export default function TenantManagement({ isDatabaseReady = true }) {
  const [activeMenu, setActiveMenu] = useState('all');
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

  useEffect(() => { loadTenants(); }, [loadTenants]);

  // Count by status for menu badges
  const statusCounts = useMemo(() => ({
    all: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    trial: tenants.filter(t => t.status === 'trial').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
  }), [tenants]);

  // Filter by active menu + search
  const filteredTenants = useMemo(() => {
    let list = tenants;
    if (activeMenu !== 'all') list = list.filter(t => t.status === activeMenu);
    if (!searchText) return list;
    const q = searchText.toLowerCase();
    return list.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.tenantId?.toLowerCase().includes(q) ||
      t.metadata?.contactEmail?.toLowerCase().includes(q) ||
      t.plan?.toLowerCase().includes(q)
    );
  }, [tenants, activeMenu, searchText]);

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

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={messages.platformAdmin.tenants.title} subtitle={`${tenants.length} organization${tenants.length !== 1 ? 's' : ''}`} icon={Building2} />

      <div className="flex gap-4">
        {/* Left Menu */}
        <div className="w-48 flex-shrink-0">
          <Card variant="flat" className="p-2">
            {MENU_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              const count = statusCounts[item.id] || 0;
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
                placeholder="Search tenants..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all" />
              {searchText && (
                <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"><X size={14} /></button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setEditingTenant(null); setIsFormOpen(true); }}>Create Tenant</Button>
              <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={loadTenants} disabled={loading} />
            </div>
          </Card>

          {/* Tenant Grid */}
          {filteredTenants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTenants.map(tenant => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  onEdit={(t) => { setEditingTenant(t); setIsFormOpen(true); }}
                  onDelete={(t) => { setDeletingTenant(t); setIsDeleteOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Building2 size={40} className="text-surface-300" />}
              title={searchText ? 'No tenants match your search' : `No ${activeMenu === 'all' ? '' : activeMenu + ' '}tenants found`}
              description={searchText ? 'Try adjusting your search terms' : 'Create your first tenant to get started'}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <ActionModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingTenant ? 'Edit Tenant' : 'Create Tenant'} icon={Building2} size="xl" variant="custom">
        <TenantForm mode="admin" initialData={editingTenant} isEditing={!!editingTenant} onSubmit={handleSave} onCancel={() => setIsFormOpen(false)} isLoading={saving} />
      </ActionModal>

      {/* Delete Confirmation */}
      <ActionModal isOpen={isDeleteOpen} onClose={() => { setIsDeleteOpen(false); setDeletingTenant(null); }} title="Delete Tenant" icon={AlertTriangle} size="sm" variant="confirm" confirmLabel="Delete Tenant" confirmVariant="danger" onConfirm={handleDelete} isProcessing={deleting}>
        <div className="py-2">
          <p className="text-sm text-surface-600">Are you sure you want to delete <strong className="text-surface-800">{deletingTenant?.name}</strong>?</p>
          <p className="text-xs text-rose-500 mt-2">This action cannot be undone. All tenant data, users, and module subscriptions will be permanently removed.</p>
        </div>
      </ActionModal>
    </div>
  );
}
