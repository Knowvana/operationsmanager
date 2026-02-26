// ============================================================================
// PlatformService — Backend API client for platform-level operations.
//
// ARCHITECTURE NOTE:
// This service communicates with the operationsmanager-api backend.
// ALL database operations go through the backend API — the frontend
// never talks to Supabase/PostgreSQL directly.
//
// Features:
//   - Database status checks via backend API
//   - Table row counts via backend API
//   - Tenant CRUD via backend API
//   - System configuration management via backend API
//   - Database wipe/reset via backend API
//
// Usage:
//   import { PlatformService } from '@shared';
//   const stats = await PlatformService.getDatabaseStats();
//   const tenants = await PlatformService.getTenants();
// ============================================================================
import ApiClient from './apiClient';
import Logger from './logger';

const PlatformService = {
  /**
   * Check if the database is initialized via backend health stats.
   */
  async isDatabaseInitialized() {
    try {
      const response = await ApiClient.get('/health/ready');
      return response.status === 'ready' && response.database?.connected;
    } catch (err) {
      console.error('isDatabaseInitialized error:', err);
      return false;
    }
  },

  /**
   * Get aggregated database stats via backend API.
   */
  async getDatabaseStats() {
    try {
      const response = await ApiClient.get('/database/stats');
      if (response.success && response.data) {
        const d = response.data;
        return {
          adminCount: d.application_admins || 0,
          tenantCount: d.tenants || 0,
          userCount: d.users || 0,
          logCount: d.logs || 0,
          configCount: d.system_config || 0,
          subscriptionCount: d.subscriptions || 0,
          roleCount: d.roles || 0,
        };
      }
      return { adminCount: 0, tenantCount: 0, userCount: 0, logCount: 0, configCount: 0, subscriptionCount: 0, roleCount: 0 };
    } catch (err) {
      console.warn('[PlatformService] getDatabaseStats failed:', err.message);
      return { adminCount: 0, tenantCount: 0, userCount: 0, logCount: 0, configCount: 0, subscriptionCount: 0, roleCount: 0 };
    }
  },

  // =========================================================================
  // TENANT CRUD
  // =========================================================================

  /**
   * Get all tenants.
   */
  async getTenants() {
    try {
      const response = await ApiClient.get('/tenants');
      return response.data || [];
    } catch (err) {
      console.error('[PlatformService] getTenants error:', err);
      return [];
    }
  },

  /**
   * Get all tenants (alias for getTenants).
   */
  async getAllTenants() {
    return PlatformService.getTenants();
  },

  /**
   * Get a single tenant by ID.
   */
  async getTenant(tenantId) {
    try {
      const response = await ApiClient.get(`/tenants/${tenantId}`);
      return response.data || null;
    } catch (err) {
      console.error('[PlatformService] getTenant error:', err);
      return null;
    }
  },

  /**
   * Create a new tenant.
   */
  async createTenant(tenantData) {
    const response = await ApiClient.post('/tenants', tenantData);
    if (!response.success) throw new Error(response.error?.message || 'Failed to create tenant');
    return response.data;
  },

  /**
   * Update an existing tenant.
   */
  async updateTenant(tenantId, updates) {
    const response = await ApiClient.put(`/tenants/${tenantId}`, updates);
    if (!response.success) throw new Error(response.error?.message || 'Failed to update tenant');
    return response.data;
  },

  /**
   * Delete a tenant.
   */
  async deleteTenant(tenantId) {
    const response = await ApiClient.delete(`/tenants/${tenantId}`);
    if (!response.success) throw new Error(response.error?.message || 'Failed to delete tenant');
  },

  /**
   * Get all system admins.
   */
  async getSystemAdmins() {
    // TODO: Add dedicated admin endpoint in backend
    return [];
  },

  // =========================================================================
  // SYSTEM CONFIGURATION
  // =========================================================================

  /**
   * Get a system config entry by key.
   */
  async getSystemConfig(configKey) {
    try {
      const response = await ApiClient.get(`/config/${configKey}`);
      if (response.success && response.data) {
        return {
          id: response.data.id,
          configKey: response.data.config_key,
          value: response.data.config_value,
          description: response.data.description,
          updatedBy: response.data.updated_by,
          updatedAt: response.data.updated_at,
        };
      }
      return null;
    } catch (err) {
      console.error(`[PlatformService] Error getting config ${configKey}:`, err);
      return null;
    }
  },

  /**
   * Update a system config entry (upsert).
   */
  async updateSystemConfig(configKey, updates) {
    try {
      const response = await ApiClient.put(`/config/${configKey}`, {
        configValue: updates.value || updates,
        description: updates.description || '',
      });
      if (!response.success) throw new Error(response.error?.message || 'Config update failed');
      Logger.api('PUT', `/config/${configKey}`, 200, 0);
      return { id: configKey, ...updates };
    } catch (err) {
      console.error(`[PlatformService] Error updating config ${configKey}:`, err);
      Logger.error('PlatformService', `Failed to update config ${configKey}`, { error: err.message });
      throw err;
    }
  },

  /**
   * Get all system config entries.
   */
  async getAllSystemConfig() {
    try {
      const response = await ApiClient.get('/config');
      if (response.success && response.data) {
        return response.data.map(d => ({
          id: d.id,
          configKey: d.config_key,
          value: d.config_value,
          description: d.description,
          updatedBy: d.updated_by,
          updatedAt: d.updated_at,
        }));
      }
      return [];
    } catch (err) {
      console.error('[PlatformService] Error getting all config:', err);
      return [];
    }
  },

  // =========================================================================
  // DATABASE STATUS
  // =========================================================================

  /**
   * Get database state via backend health stats.
   */
  async getDatabaseState() {
    try {
      const response = await ApiClient.get('/health/ready');
      if (response.status === 'ready' && response.database?.connected) {
        return 'initialized';
      }
      return 'not_initialized';
    } catch (err) {
      console.warn('[PlatformService] getDatabaseState failed:', err.message);
      return 'unknown';
    }
  },

  // =========================================================================
  // DATABASE DELETION (DESTRUCTIVE)
  // =========================================================================

  /**
   * Wipe all data from all tables (truncate, but keep schema).
   */
  async wipeAllCollections() {
    try {
      const response = await ApiClient.post('/database/wipe', { confirm: 'WIPE_ALL_DATA' });
      if (!response.success) throw new Error(response.error?.message || 'Wipe failed');
      Logger.info('PlatformService', 'Database wiped successfully', response.data);
      return response.data;
    } catch (err) {
      console.error('[PlatformService] Error wiping database:', err);
      Logger.error('PlatformService', 'Failed to wipe database', { error: err.message });
      throw err;
    }
  },

  /**
   * Delete all data from all tables (complete reset).
   */
  async deleteAllCollections() {
    return PlatformService.wipeAllCollections();
  },

  // Utility: get schema info
  getSchemaInfo() {
    const tables = ['roles', 'subscriptions', 'tenants', 'application_admins', 'users', 'logs', 'system_config'];
    return {
      databaseType: 'PostgreSQL',
      provider: 'Backend API → Supabase',
      tableCount: tables.length,
      tables: tables.map(t => ({ name: t })),
    };
  },
};

export default PlatformService;
