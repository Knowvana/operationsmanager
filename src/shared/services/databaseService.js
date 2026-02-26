// ============================================================================
// DatabaseService — Backend API client for database operations
//
// ARCHITECTURE NOTE:
// This service communicates with the operationsmanager-api backend.
// ALL database operations go through the backend API — the frontend
// never talks to Supabase/PostgreSQL directly.
//
// Features:
//   - Connection testing via backend API
//   - Schema initialization via backend API
//   - Default data seeding via backend API
//   - Demo data loading via backend API
//   - Connection status tracking
//
// Usage:
//   import { DatabaseService } from '@shared';
//   const result = await DatabaseService.testConnection();
// ============================================================================
import ApiClient from './apiClient';

let _connectionStatus = 'unknown'; // 'connected' | 'disconnected' | 'unknown' | 'error'
let _lastError = null;

const DatabaseService = {
  /**
   * Get the API client instance (for backward compatibility).
   * Returns the ApiClient instead of a Supabase client.
   */
  getClient() {
    return ApiClient;
  },

  /**
   * Get the current connection config (without sensitive data).
   */
  getConfig() {
    return {
      apiBaseUrl: ApiClient.getBaseUrl(),
      provider: 'Backend API → Supabase PostgreSQL',
    };
  },

  /**
   * Get the current connection status.
   */
  getConnectionStatus() {
    return { status: _connectionStatus, lastError: _lastError };
  },

  /**
   * Test the database connection via backend API.
   * @returns {{ success: boolean, latencyMs: number, error?: string }}
   */
  async testConnection() {
    try {
      const start = performance.now();
      const response = await ApiClient.post('/database/test-connection');
      const latencyMs = Math.round(performance.now() - start);

      if (response.success && response.data?.connected) {
        _connectionStatus = 'connected';
        _lastError = null;
        return {
          success: true,
          latencyMs,
          schemaExists: response.data.schemaExists !== false,
        };
      }

      _connectionStatus = 'error';
      _lastError = response.data?.error || 'Connection test failed';
      return { success: false, latencyMs, error: _lastError };
    } catch (err) {
      if (err.networkError) {
        _connectionStatus = 'api_unreachable';
        _lastError = 'Backend API unreachable. Is the server running?';
        return { success: false, latencyMs: 0, error: _lastError, networkError: true };
      }
      _connectionStatus = 'error';
      _lastError = err.message;
      return { success: false, latencyMs: 0, error: err.message };
    }
  },

  /**
   * Check if the database schema has been created.
   * @returns {{ initialized: boolean, tables: string[], missing: string[] }}
   */
  async checkSchemaStatus() {
    try {
      const response = await ApiClient.get('/database/schema-status');
      return response.data || { initialized: false, tables: [], missing: [] };
    } catch (err) {
      console.warn('[DatabaseService] checkSchemaStatus failed:', err.message);
      return { initialized: false, tables: [], missing: [], error: err.message };
    }
  },

  /**
   * Check if default data has been loaded.
   * @returns {{ loaded: boolean, details: object }}
   */
  async checkDefaultDataStatus() {
    try {
      const response = await ApiClient.get('/database/default-data-status');
      return response.data || { loaded: false, details: {} };
    } catch (err) {
      console.warn('[DatabaseService] checkDefaultDataStatus failed:', err.message);
      return { loaded: false, details: {}, error: err.message };
    }
  },

  /**
   * Check if demo data has been loaded.
   * @returns {{ loaded: boolean, details: object }}
   */
  async checkDemoDataStatus() {
    try {
      const response = await ApiClient.get('/database/demo-data-status');
      return response.data || { loaded: false, details: {} };
    } catch (err) {
      return { loaded: false, details: {}, error: err.message };
    }
  },

  /**
   * Initialize the database schema via backend API.
   */
  async initializeSchema() {
    try {
      const response = await ApiClient.post('/database/create-schema');
      return response.data || { success: false };
    } catch (err) {
      throw new Error(err.message || 'Schema initialization failed');
    }
  },

  /**
   * Load default data via backend API.
   */
  async loadDefaultData() {
    try {
      const response = await ApiClient.post('/database/load-default-data');
      return response.data || { success: false };
    } catch (err) {
      throw new Error(err.message || 'Default data loading failed');
    }
  },

  /**
   * Load demo data via backend API.
   */
  async loadDemoData() {
    try {
      const response = await ApiClient.post('/database/load-demo-data');
      return response.data || { success: false };
    } catch (err) {
      throw new Error(err.message || 'Demo data loading failed');
    }
  },

  /**
   * Delete demo data from the database.
   */
  async deleteDemoData() {
    // TODO: Add backend endpoint for demo data deletion
    return { results: [] };
  },

  /**
   * Wipe all data (keep schema).
   */
  async wipeAllData() {
    try {
      const response = await ApiClient.post('/database/wipe', { confirm: 'WIPE_ALL_DATA' });
      return response.data || { success: false };
    } catch (err) {
      throw new Error(err.message || 'Data wipe failed');
    }
  },

  /**
   * Reset the connection status.
   */
  resetClient() {
    _connectionStatus = 'unknown';
    _lastError = null;
  },
};

export default DatabaseService;
