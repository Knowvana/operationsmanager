// ============================================================================
// BaseConnector — Abstract base class for all external system connectors
//
// ARCHITECTURE NOTE:
// All connectors (ServiceNow, PostgreSQL, GCP, REST APIs) inherit from this
// to ensure consistent interface, error handling, and lifecycle management.
//
// Contract:
//   - initialize(config) — Set up connection with credentials
//   - connect() — Establish connection, validate credentials
//   - disconnect() — Clean up resources
//   - fetch(query) — Execute query/request, return normalized data
//   - getStatus() — Return connection health status
//   - getSchema() — Return data structure/fields available
// ============================================================================

export default class BaseConnector {
  constructor(name, type) {
    this.name = name;           // e.g., 'ServiceNow', 'PostgreSQL'
    this.type = type;           // e.g., 'incident-management', 'database'
    this.isConnected = false;
    this.lastError = null;
    this.lastFetchTime = null;
    this.config = {};
  }

  /**
   * Initialize connector with configuration
   * @param {object} config - Connector-specific config (credentials, endpoints, etc.)
   */
  async initialize(config) {
    this.config = config;
    this.lastError = null;
  }

  /**
   * Establish connection to external system
   * @returns {Promise<boolean>} - true if successful
   */
  async connect() {
    throw new Error(`${this.name}.connect() not implemented`);
  }

  /**
   * Close connection and clean up resources
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.isConnected = false;
  }

  /**
   * Execute query/request and return normalized data
   * @param {object} query - Query object (structure varies by connector)
   * @returns {Promise<object>} - Normalized data { success, data, error, metadata }
   */
  async fetch(query) {
    throw new Error(`${this.name}.fetch() not implemented`);
  }

  /**
   * Get connector health status
   * @returns {object} - { isConnected, lastError, lastFetchTime, responseTime }
   */
  getStatus() {
    return {
      name: this.name,
      type: this.type,
      isConnected: this.isConnected,
      lastError: this.lastError,
      lastFetchTime: this.lastFetchTime,
      responseTime: this.responseTime || null,
    };
  }

  /**
   * Get schema/structure of available data
   * @returns {Promise<object>} - Schema definition
   */
  async getSchema() {
    throw new Error(`${this.name}.getSchema() not implemented`);
  }

  /**
   * Normalize raw data to common schema
   * @param {any} rawData - Raw response from external system
   * @returns {object} - Normalized data
   */
  normalizeData(rawData) {
    // Override in subclasses
    return rawData;
  }

  /**
   * Handle and log errors
   * @param {Error} error - Error object
   * @param {string} context - Where error occurred
   */
  handleError(error, context = '') {
    this.lastError = {
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack,
    };
    console.error(`[${this.name}] ${context}:`, error);
  }

  /**
   * Validate configuration before connecting
   * @returns {object} - { valid: boolean, errors: string[] }
   */
  validateConfig() {
    return { valid: true, errors: [] };
  }
}
