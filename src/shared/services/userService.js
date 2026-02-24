// ============================================================================
// UserService — CRUD operations for self-registered platform users.
//
// ARCHITECTURE NOTE:
// This service handles all Firestore operations for the Users collection.
// Users are distinct from SystemAdmins — they register publicly, own tenants,
// and access modules. Passwords are stored as bcrypt hashes via AuthService.
//
// The collection path is derived from user-schema.json.
//
// Usage:
//   import { UserService } from '@shared';
//   const user = await UserService.registerUser({ email, displayName, password });
//   const authed = await UserService.authenticateUser(email, password);
// ============================================================================
import userSchema from '@config/user-schema.json';
import AuthService from './authService';
import Logger from './logger';

let _db = null;

async function getDb() {
  if (_db) return _db;
  const { getApps } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const existingApps = getApps();
  const app = existingApps.find(a => a.name === '[DEFAULT]') || existingApps[0];
  if (!app) throw new Error('Firebase not initialized');
  _db = getFirestore(app);
  return _db;
}

function getCollectionPath() {
  return userSchema.full_path;
}

const UserService = {
  /**
   * Register a new user. Hashes password before storage.
   * @param {{ email: string, displayName: string, password: string, phone?: string }} data
   * @returns {Promise<object>} The created user document (without password)
   */
  async registerUser(data) {
    const db = await getDb();
    const { doc, setDoc, serverTimestamp, collection, getDocs, query, where, limit } = await import('firebase/firestore');
    const path = getCollectionPath();

    // Check for duplicate email
    const existing = await getDocs(query(collection(db, path), where('email', '==', data.email.toLowerCase()), limit(1)));
    if (existing.size > 0) {
      throw new Error('An account with this email already exists.');
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(data.password);
    // Use email as the document ID (sanitized for Firestore path safety)
    const emailId = data.email.toLowerCase().trim();
    const userId = emailId;

    const document = {
      userId,
      email: emailId,
      displayName: data.displayName.trim(),
      passwordHash,
      phone: data.phone?.trim() || '',
      status: 'active',
      role: 'tenant_owner',
      tenantId: '',
      createdAt: serverTimestamp(),
      lastLoginAt: null,
      metadata: {
        registrationSource: 'self_registration',
        agreedToTerms: true,
        registeredAt: new Date().toISOString(),
      },
    };

    await setDoc(doc(db, path, emailId), document);
    Logger.info('UserService', `User registered: ${data.email}`, { userId });

    // Return user without sensitive data
    const { passwordHash: _, ...safeUser } = document;
    return { id: userId, ...safeUser };
  },

  /**
   * Authenticate a user by email + password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} Authenticated user object
   */
  async authenticateUser(email, password) {
    const db = await getDb();
    const { collection, getDocs, query, where, limit, doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const path = getCollectionPath();

    const snap = await getDocs(query(collection(db, path), where('email', '==', email.toLowerCase().trim()), limit(1)));
    if (snap.empty) {
      throw new Error('Invalid email or password.');
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    if (userData.status === 'suspended') {
      throw new Error('Your account has been suspended. Please contact support.');
    }
    if (userData.status === 'inactive') {
      throw new Error('Your account is inactive. Please contact support.');
    }

    const isValid = await AuthService.verifyPassword(password, userData.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    // Update lastLoginAt
    await updateDoc(doc(db, path, userDoc.id), { lastLoginAt: serverTimestamp() });
    Logger.info('UserService', `User logged in: ${email}`, { userId: userData.userId });

    // Return user without sensitive data
    const { passwordHash: _, ...safeUser } = userData;
    return { id: userDoc.id, ...safeUser, isSystemAdmin: false, isTenantUser: true };
  },

  /**
   * Update a user's tenantId after tenant creation.
   */
  async linkUserToTenant(userId, tenantId) {
    const db = await getDb();
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const path = getCollectionPath();
    await updateDoc(doc(db, path, userId), { tenantId, updatedAt: serverTimestamp() });
    Logger.info('UserService', `Linked user ${userId} to tenant ${tenantId}`);
  },

  /**
   * Get a user by ID.
   */
  async getUserById(userId) {
    const db = await getDb();
    const { doc, getDoc } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDoc(doc(db, path, userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const { passwordHash: _, ...safeUser } = data;
    return { id: snap.id, ...safeUser };
  },

  /**
   * Get all users (admin use).
   */
  async getAllUsers() {
    const db = await getDb();
    const { collection, getDocs } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => {
      const data = d.data();
      const { passwordHash: _, ...safeUser } = data;
      return { id: d.id, ...safeUser };
    });
  },

  /**
   * Get user count.
   */
  async getUserCount() {
    const db = await getDb();
    const { collection, getDocs } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDocs(collection(db, path));
    return snap.size;
  },

  /**
   * Get users belonging to a specific tenant.
   */
  async getUsersByTenant(tenantId) {
    const db = await getDb();
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDocs(query(collection(db, path), where('tenantId', '==', tenantId)));
    return snap.docs.map((d) => {
      const data = d.data();
      const { passwordHash: _, ...safeUser } = data;
      return { id: d.id, ...safeUser };
    });
  },

  /**
   * Get count of users in a specific tenant.
   */
  async getTenantUserCount(tenantId) {
    const db = await getDb();
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDocs(query(collection(db, path), where('tenantId', '==', tenantId)));
    return snap.size;
  },

  /**
   * Create a tenant user (created by TenantAdmin).
   * Enforces: max user limit per tier, duplicate email, 1 TenantAdmin per tenant.
   * @param {{ email, displayName, password, phone?, role }} data
   * @param {string} tenantId
   * @param {number} maxUsers - Max users allowed for this tenant's tier
   */
  async createTenantUser(data, tenantId, maxUsers = 5) {
    const db = await getDb();
    const { doc, setDoc, serverTimestamp, collection, getDocs, query, where, limit } = await import('firebase/firestore');
    const path = getCollectionPath();

    // Check max users for tenant
    const currentCount = await this.getTenantUserCount(tenantId);
    if (maxUsers > 0 && currentCount >= maxUsers) {
      throw new Error(`Cannot create more users. Maximum user limit (${maxUsers}) reached for this tenant.`);
    }

    // Check duplicate email globally
    const emailCheck = await getDocs(query(collection(db, path), where('email', '==', data.email.toLowerCase().trim()), limit(1)));
    if (emailCheck.size > 0) {
      throw new Error('A user with this email already exists.');
    }

    // Enforce 1 TenantAdmin per tenant
    if (data.role === 'tenant_admin') {
      const adminCheck = await getDocs(query(
        collection(db, path),
        where('tenantId', '==', tenantId),
        where('role', '==', 'tenant_admin')
      ));
      if (adminCheck.size > 0) {
        throw new Error('A tenant can only have one Tenant Admin. This tenant already has a Tenant Admin.');
      }
    }

    const passwordHash = await AuthService.hashPassword(data.password);
    // Use email as the document ID
    const emailId = data.email.toLowerCase().trim();
    const userId = emailId;

    const document = {
      userId,
      email: emailId,
      displayName: data.displayName.trim(),
      passwordHash,
      phone: data.phone?.trim() || '',
      status: 'active',
      role: data.role || 'tenant_user',
      tenantId,
      createdAt: serverTimestamp(),
      lastLoginAt: null,
      metadata: {
        registrationSource: 'admin_created',
        agreedToTerms: false,
        registeredAt: new Date().toISOString(),
      },
    };

    await setDoc(doc(db, path, emailId), document);
    Logger.info('UserService', `Tenant user created: ${data.email}`, { userId, tenantId, role: data.role });

    const { passwordHash: _, ...safeUser } = document;
    return { id: userId, ...safeUser };
  },

  /**
   * Update a user document.
   */
  async updateUser(userId, updates) {
    const db = await getDb();
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const path = getCollectionPath();
    await updateDoc(doc(db, path, userId), { ...updates, updatedAt: serverTimestamp() });
    Logger.info('UserService', `User updated: ${userId}`, { updates: Object.keys(updates) });
  },

  /**
   * Delete a user.
   */
  async deleteUser(userId) {
    const db = await getDb();
    const { doc, deleteDoc } = await import('firebase/firestore');
    const path = getCollectionPath();
    await deleteDoc(doc(db, path, userId));
    Logger.info('UserService', `User deleted: ${userId}`);
  },

  /**
   * Get comprehensive user stats for platform overview.
   * Returns: total, active, byPlan (free/paid), addedThisWeek
   */
  async getUserStats() {
    const db = await getDb();
    const { collection, getDocs } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDocs(collection(db, path));

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let total = 0, active = 0, addedThisWeek = 0;
    const tenantIds = new Set();

    snap.docs.forEach((d) => {
      const data = d.data();
      total++;
      if (data.status === 'active') active++;
      if (data.tenantId) tenantIds.add(data.tenantId);
      // Check if created this week
      const created = data.metadata?.registeredAt ? new Date(data.metadata.registeredAt) : null;
      if (created && created >= weekAgo) addedThisWeek++;
    });

    return { total, active, inactive: total - active, addedThisWeek, tenantCount: tenantIds.size };
  },

  /**
   * Check if an email is already in use.
   */
  async isEmailTaken(email) {
    const db = await getDb();
    const { collection, getDocs, query, where, limit } = await import('firebase/firestore');
    const path = getCollectionPath();
    const snap = await getDocs(query(collection(db, path), where('email', '==', email.toLowerCase().trim()), limit(1)));
    return snap.size > 0;
  },
};

export default UserService;
