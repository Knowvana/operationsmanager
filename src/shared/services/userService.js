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
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const document = {
      userId,
      email: data.email.toLowerCase().trim(),
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

    await setDoc(doc(db, path, userId), document);
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
};

export default UserService;
