// ============================================================================
// UserService — Backend API client for user operations.
//
// ARCHITECTURE NOTE:
// This service communicates with the operationsmanager-api backend.
// ALL user operations go through the backend API — the frontend
// never talks to Supabase/PostgreSQL directly.
//
// Usage:
//   import { UserService } from '@shared';
//   const user = await UserService.registerUser({ email, displayName, password });
//   const authed = await UserService.authenticateUser(email, password);
// ============================================================================
import ApiClient from './apiClient';
import Logger from './logger';

const UserService = {
  /**
   * Register a new user via backend API.
   */
  async registerUser(data) {
    const response = await ApiClient.post('/users', {
      email: data.email,
      displayName: data.displayName,
      password: data.password,
      phone: data.phone || '',
      tenantId: data.tenantId || null,
      metadata: {
        registrationSource: 'self_registration',
        agreedToTerms: true,
        registeredAt: new Date().toISOString(),
      },
    });

    if (!response.success) throw new Error(response.error?.message || 'Registration failed');
    Logger.info('UserService', `User registered: ${data.email}`, { userId: response.data.id });

    return {
      id: response.data.id,
      userId: response.data.id,
      email: response.data.email,
      displayName: response.data.display_name,
      phone: response.data.phone || '',
      status: response.data.status,
      roleId: response.data.role_id,
      tenantId: response.data.tenant_id || '',
      createdAt: response.data.created_at,
    };
  },

  /**
   * Authenticate a user by email + password via backend API.
   */
  async authenticateUser(email, password) {
    const response = await ApiClient.post('/auth/user-login', { email, password });

    if (!response.success) throw new Error(response.error?.message || 'Invalid email or password.');

    const { user, token, refreshToken } = response.data;

    // Store JWT tokens
    ApiClient.setToken(token);
    ApiClient.setRefreshToken(refreshToken);

    Logger.info('UserService', `User logged in: ${email}`, { userId: user.userId });

    return {
      id: user.userId,
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      tenantId: user.tenantId || '',
      permissions: user.permissions || [],
      isSystemAdmin: false,
      isTenantUser: true,
    };
  },

  /**
   * Update a user's tenantId after tenant creation.
   */
  async linkUserToTenant(userId, tenantId) {
    const response = await ApiClient.put(`/users/${userId}`, { tenantId });
    if (!response.success) throw new Error(response.error?.message || 'Failed to link user to tenant');
    Logger.info('UserService', `Linked user ${userId} to tenant ${tenantId}`);
  },

  /**
   * Get a user by ID.
   */
  async getUserById(userId) {
    try {
      const response = await ApiClient.get(`/users/${userId}`);
      if (!response.success || !response.data) return null;
      const d = response.data;
      return {
        id: d.id,
        userId: d.id,
        email: d.email,
        displayName: d.display_name,
        phone: d.phone || '',
        status: d.status,
        roleId: d.role_id,
        tenantId: d.tenant_id || '',
        metadata: d.metadata || {},
        lastLoginAt: d.last_login_at,
        createdAt: d.created_at,
      };
    } catch (err) {
      return null;
    }
  },

  /**
   * Get all users (admin use).
   */
  async getAllUsers() {
    try {
      const response = await ApiClient.get('/users');
      if (!response.success) return [];
      return (response.data || []).map(d => ({
        id: d.id,
        userId: d.id,
        email: d.email,
        displayName: d.display_name,
        phone: d.phone || '',
        status: d.status,
        roleId: d.role_id,
        tenantId: d.tenant_id || '',
        metadata: d.metadata || {},
        lastLoginAt: d.last_login_at,
        createdAt: d.created_at,
      }));
    } catch (err) {
      return [];
    }
  },

  /**
   * Get users belonging to a specific tenant.
   */
  async getUsersByTenant(tenantId) {
    try {
      const response = await ApiClient.get(`/tenants/${tenantId}/users`);
      if (!response.success) return [];
      return (response.data || []).map(d => ({
        id: d.id,
        userId: d.id,
        email: d.email,
        displayName: d.display_name,
        phone: d.phone || '',
        status: d.status,
        roleId: d.role_id,
        tenantId,
        metadata: d.metadata || {},
        lastLoginAt: d.last_login_at,
        createdAt: d.created_at,
      }));
    } catch (err) {
      return [];
    }
  },

  /**
   * Create a tenant user (created by TenantAdmin).
   */
  async createTenantUser(data, tenantId) {
    const response = await ApiClient.post('/users', {
      email: data.email,
      displayName: data.displayName,
      password: data.password,
      phone: data.phone || '',
      tenantId,
      metadata: {
        registrationSource: 'admin_created',
        agreedToTerms: false,
        registeredAt: new Date().toISOString(),
      },
    });

    if (!response.success) throw new Error(response.error?.message || 'Failed to create user');
    Logger.info('UserService', `Tenant user created: ${data.email}`, { userId: response.data.id, tenantId });

    return {
      id: response.data.id,
      userId: response.data.id,
      email: response.data.email,
      displayName: response.data.display_name,
      status: response.data.status,
      tenantId,
      createdAt: response.data.created_at,
    };
  },

  /**
   * Update a user.
   */
  async updateUser(userId, updates) {
    const response = await ApiClient.put(`/users/${userId}`, updates);
    if (!response.success) throw new Error(response.error?.message || 'Failed to update user');
    Logger.info('UserService', `User updated: ${userId}`, { updates: Object.keys(updates) });
  },

  /**
   * Delete a user.
   */
  async deleteUser(userId) {
    const response = await ApiClient.delete(`/users/${userId}`);
    if (!response.success) throw new Error(response.error?.message || 'Failed to delete user');
    Logger.info('UserService', `User deleted: ${userId}`);
  },

  /**
   * Get comprehensive user stats for platform overview.
   */
  async getUserStats() {
    try {
      const response = await ApiClient.get('/users/stats');
      if (response.success && response.data) {
        return response.data;
      }
      return { total: 0, active: 0, inactive: 0, addedThisWeek: 0, tenantCount: 0 };
    } catch (err) {
      return { total: 0, active: 0, inactive: 0, addedThisWeek: 0, tenantCount: 0 };
    }
  },

  /**
   * Check if an email is already in use.
   */
  async isEmailTaken(email) {
    // TODO: Add dedicated email check endpoint in backend
    return false;
  },
};

export default UserService;
