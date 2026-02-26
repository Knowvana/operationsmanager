// ============================================================================
// ApiClient — Centralized HTTP client for backend API communication
//
// ARCHITECTURE NOTE:
// - Single entry point for ALL backend API calls
// - Handles JWT token management (attach, refresh, store)
// - Consistent error handling and response parsing
// - Stateless: token stored in localStorage, no in-memory sessions
// - Kubernetes-ready: works with any backend URL
//
// Usage:
//   import { ApiClient } from '@shared';
//   const result = await ApiClient.get('/health');
//   const data = await ApiClient.post('/auth/login', { email, password });
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'ops_manager_token';
const REFRESH_TOKEN_KEY = 'ops_manager_refresh_token';

const ApiClient = {
  /**
   * Get the configured API base URL.
   */
  getBaseUrl() {
    return API_BASE_URL;
  },

  /**
   * Get the stored JWT token.
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Store JWT token.
   */
  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  /**
   * Store refresh token.
   */
  setRefreshToken(token) {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  /**
   * Get stored refresh token.
   */
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Clear all stored tokens (logout).
   */
  clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Build headers for API requests.
   */
  _getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  /**
   * Core fetch wrapper with error handling.
   * @param {string} endpoint - API endpoint (e.g., '/health')
   * @param {object} options - fetch options
   * @returns {Promise<object>} - Parsed response
   */
  async _fetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: this._getHeaders(options.headers),
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle 401 — token expired
        if (response.status === 401) {
          this.clearTokens();
        }

        const error = new Error(data?.error?.message || `API Error: ${response.status}`);
        error.status = response.status;
        error.code = data?.error?.code || 'API_ERROR';
        error.details = data?.error?.details;
        error.requestId = data?.error?.requestId;
        throw error;
      }

      return data;
    } catch (err) {
      // Network errors
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        const networkError = new Error('Backend API unreachable. Is the server running?');
        networkError.status = 0;
        networkError.code = 'NETWORK_ERROR';
        networkError.networkError = true;
        throw networkError;
      }
      throw err;
    }
  },

  /**
   * GET request.
   * @param {string} endpoint
   * @param {object} params - Query parameters
   */
  async get(endpoint, params = {}) {
    const queryString = Object.keys(params).length > 0
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this._fetch(`${endpoint}${queryString}`, { method: 'GET' });
  },

  /**
   * POST request.
   * @param {string} endpoint
   * @param {object} body
   */
  async post(endpoint, body = {}) {
    return this._fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * PUT request.
   * @param {string} endpoint
   * @param {object} body
   */
  async put(endpoint, body = {}) {
    return this._fetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  /**
   * DELETE request.
   * @param {string} endpoint
   */
  async delete(endpoint) {
    return this._fetch(endpoint, { method: 'DELETE' });
  },
};

export default ApiClient;
