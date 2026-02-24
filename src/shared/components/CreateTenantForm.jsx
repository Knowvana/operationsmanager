// ============================================================================
// CreateTenantForm — Reusable tenant creation/edit form.
//
// ARCHITECTURE NOTE:
// Used in TWO contexts:
//   1. Admin TenantManagement — full options (status, plan, modules, contact)
//   2. User Registration Wizard — simplified (just tenant name + industry)
//
// The `mode` prop controls which fields are shown:
//   - 'admin' (default): All fields visible
//   - 'user': Only tenant name, industry, contact email
//
// The form does NOT handle save/submit — it calls `onSubmit(formData)`.
// The parent controls the modal, loading state, and persistence.
//
// Usage:
//   <CreateTenantForm
//     mode="admin"
//     initialData={existingTenant}
//     onSubmit={handleSave}
//     onCancel={handleClose}
//     isLoading={saving}
//   />
// ============================================================================
import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@shared';

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
  subscribedModules: [],
  metadata: { industry: '', contactEmail: '', contactPhone: '' },
};

export default function CreateTenantForm({
  mode = 'admin',
  initialData = null,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
  submitLabel,
}) {
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        tenantId: initialData.tenantId || initialData.id || `tenant_${Date.now()}`,
        status: initialData.status || 'trial',
        plan: initialData.plan || 'free',
        subscribedModules: initialData.subscribedModules || [],
        metadata: {
          industry: initialData.metadata?.industry || '',
          contactEmail: initialData.metadata?.contactEmail || '',
          contactPhone: initialData.metadata?.contactPhone || '',
        },
      });
    } else {
      setFormData({ ...EMPTY_FORM, tenantId: `tenant_${Date.now()}` });
    }
  }, [initialData]);

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

  const handleSubmit = () => {
    onSubmit?.(formData);
  };

  const isAdmin = mode === 'admin';
  const defaultSubmitLabel = submitLabel || (isEditing ? 'Update Tenant' : 'Create Tenant');

  return (
    <div className="space-y-5">
      {/* Tenant ID — always read-only, auto-generated, shown first */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Tenant Identifier</h4>
        <FormField label="Tenant ID" hint="Auto-generated, read-only">
          <input
            type="text"
            value={formData.tenantId}
            readOnly
            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-surface-50 text-surface-500 font-mono cursor-not-allowed"
          />
        </FormField>
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-surface-200 to-transparent" />

      {/* Basic Info */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Tenant Details</h4>
        <div className="space-y-3">
          <FormField label="Tenant Name" required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Acme Corporation"
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
            />
          </FormField>
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
        </div>
      </div>

      {/* Admin-only fields */}
      {isAdmin && (
        <>
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

          {/* Additional Contact Info (admin only) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">Additional Contact</h4>
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
        </>
      )}

      {/* Footer — single set of buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!formData.name.trim()}
        >
          {defaultSubmitLabel}
        </Button>
      </div>
    </div>
  );
}

// --- Local sub-component ---
function FormField({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-surface-600 mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
        {hint && <span className="text-surface-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
