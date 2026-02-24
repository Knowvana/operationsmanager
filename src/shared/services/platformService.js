// ============================================================================
// PlatformService — Reads/writes platform-level data from Firestore.
//
// ARCHITECTURE NOTE:
// This service abstracts all Firestore interactions for the core platform:
//   - Database status checks (is DB initialized?)
//   - Collection document counts
//   - Tenant CRUD operations
//   - System admin queries
//
// All paths are derived from database-schema.json so they stay in sync.
// The service lazily initializes Firebase to avoid import-time side effects.
//
// Usage:
//   import { PlatformService } from '@shared';
//   const stats = await PlatformService.getDatabaseStats();
//   const tenants = await PlatformService.getTenants();
// ============================================================================
import databaseSchema from '@config/database-schema.json';
import firebaseConfig from '@config/firebase.json';
import Logger from './logger';

let _db = null;
let _app = null;

async function getDb() {
  if (_db) return _db;
  const { initializeApp, getApps } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const existingApps = getApps();
  _app = existingApps.find(a => a.name === '[DEFAULT]') || existingApps[0];
  if (!_app) {
    _app = initializeApp(firebaseConfig);
  }
  _db = getFirestore(_app);
  return _db;
}

function getRootPath() {
  return `${databaseSchema.root_collection}/${databaseSchema.root_document}`;
}

function getCollectionPath(collectionKey) {
  const col = databaseSchema.collections[collectionKey];
  if (!col) throw new Error(`Unknown collection: ${collectionKey}`);
  return `${getRootPath()}/${col.path}`;
}

const PlatformService = {
  /**
   * Check if the database is initialized by checking if system_admins collection has documents.
   * This is more reliable than checking for a root document.
   */
  async isDatabaseInitialized() {
    try {
      const db = await getDb();
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      const path = getCollectionPath('system_admins');
      const snap = await getDocs(query(collection(db, path), limit(1)));
      return snap.size > 0;
    } catch (err) {
      console.error('isDatabaseInitialized error:', err);
      return false;
    }
  },

  /**
   * Get document count for a collection. Excludes system documents (starting with _).
   */
  async getCollectionCount(collectionKey) {
    try {
      const db = await getDb();
      const { collection, getDocs } = await import('firebase/firestore');
      const path = getCollectionPath(collectionKey);
      const snap = await getDocs(collection(db, path));
      // Filter out system documents (starting with _)
      const userDocs = snap.docs.filter(d => !d.id.startsWith('_'));
      console.log(`[PlatformService] ${collectionKey}: total=${snap.size}, user=${userDocs.length}, docs=[${snap.docs.map(d => d.id).join(', ')}]`);
      return userDocs.length;
    } catch (err) {
      console.error(`[PlatformService] Error counting ${collectionKey}:`, err);
      return 0;
    }
  },

  /**
   * Get aggregated database stats: counts for all core collections.
   */
  async getDatabaseStats() {
    const [adminCount, tenantCount, logCount, configCount] = await Promise.all([
      PlatformService.getCollectionCount('system_admins'),
      PlatformService.getCollectionCount('tenants'),
      PlatformService.getCollectionCount('system_logs'),
      PlatformService.getCollectionCount('system_config'),
    ]);
    return { adminCount, tenantCount, logCount, configCount };
  },

  // =========================================================================
  // TENANT CRUD
  // =========================================================================

  /**
   * Get all tenants.
   */
  async getTenants() {
    const db = await getDb();
    const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
    const path = getCollectionPath('tenants');
    const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Get a single tenant by ID.
   */
  async getTenant(tenantId) {
    const db = await getDb();
    const { doc, getDoc } = await import('firebase/firestore');
    const path = getCollectionPath('tenants');
    const snap = await getDoc(doc(db, path, tenantId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  },

  /**
   * Create a new tenant.
   */
  async createTenant(tenantData) {
    const db = await getDb();
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const path = getCollectionPath('tenants');
    const tenantId = tenantData.tenantId || `tenant_${Date.now()}`;
    const document = {
      ...tenantData,
      tenantId,
      status: tenantData.status || 'trial',
      plan: tenantData.plan || 'free',
      subscribedModules: tenantData.subscribedModules || [],
      maxUsers: tenantData.maxUsers || 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, path, tenantId), document);
    return { id: tenantId, ...document };
  },

  /**
   * Update an existing tenant.
   */
  async updateTenant(tenantId, updates) {
    const db = await getDb();
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const path = getCollectionPath('tenants');
    await updateDoc(doc(db, path, tenantId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return PlatformService.getTenant(tenantId);
  },

  /**
   * Delete a tenant.
   */
  async deleteTenant(tenantId) {
    const db = await getDb();
    const { doc, deleteDoc } = await import('firebase/firestore');
    const path = getCollectionPath('tenants');
    await deleteDoc(doc(db, path, tenantId));
  },

  /**
   * Get all system admins.
   */
  async getSystemAdmins() {
    const db = await getDb();
    const { collection, getDocs } = await import('firebase/firestore');
    const path = getCollectionPath('system_admins');
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // =========================================================================
  // SYSTEM CONFIGURATION
  // =========================================================================

  /**
   * Get a system config document by key.
   */
  async getSystemConfig(configKey) {
    try {
      const db = await getDb();
      const { doc, getDoc } = await import('firebase/firestore');
      const path = getCollectionPath('system_config');
      const snap = await getDoc(doc(db, path, configKey));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.error(`[PlatformService] Error getting config ${configKey}:`, err);
      return null;
    }
  },

  /**
   * Update a system config document.
   */
  async updateSystemConfig(configKey, updates) {
    try {
      const db = await getDb();
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const path = getCollectionPath('system_config');
      await setDoc(
        doc(db, path, configKey),
        {
          ...updates,
          configKey,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      Logger.api('PUT', `Firestore/${path}/${configKey}`, 200, 0);
      return { id: configKey, ...updates };
    } catch (err) {
      console.error(`[PlatformService] Error updating config ${configKey}:`, err);
      Logger.error('PlatformService', `Failed to update config ${configKey}`, { error: err.message });
      throw err;
    }
  },

  /**
   * Get all system config documents.
   */
  async getAllSystemConfig() {
    try {
      const db = await getDb();
      const { collection, getDocs } = await import('firebase/firestore');
      const path = getCollectionPath('system_config');
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('[PlatformService] Error getting all config:', err);
      return [];
    }
  },

  // =========================================================================
  // DATABASE DELETION (DESTRUCTIVE)
  // =========================================================================

  /**
   * Check if database is empty (no documents in any collection).
   */
  async isDatabaseEmpty() {
    try {
      const db = await getDb();
      const { collection, getDocs } = await import('firebase/firestore');
      
      const collectionKeys = Object.keys(databaseSchema.collections);
      
      for (const key of collectionKeys) {
        const path = getCollectionPath(key);
        const snap = await getDocs(collection(db, path));
        // Filter out system documents (starting with _)
        const userDocs = snap.docs.filter(d => !d.id.startsWith('_'));
        if (userDocs.length > 0) {
          return false; // Found at least one document
        }
      }
      
      return true; // No documents found
    } catch (err) {
      console.error('[PlatformService] Error checking if database is empty:', err);
      return false;
    }
  },

  /**
   * Get database state: 'empty', 'initialized', or 'partial'
   */
  async getDatabaseState() {
    try {
      const isInitialized = await this.isDatabaseInitialized();
      const isEmpty = await this.isDatabaseEmpty();
      
      if (!isInitialized) return 'not_initialized';
      if (isEmpty) return 'empty';
      return 'initialized';
    } catch (err) {
      console.error('[PlatformService] Error getting database state:', err);
      return 'unknown';
    }
  },

  /**
   * Wipe all documents from all collections (but keep collections).
   * This is safer than full deletion.
   */
  async wipeAllCollections() {
    try {
      const db = await getDb();
      const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      
      const collectionKeys = Object.keys(databaseSchema.collections);
      let deletedCount = 0;

      for (const key of collectionKeys) {
        const path = getCollectionPath(key);
        const snap = await getDocs(collection(db, path));
        
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, path, docSnap.id));
          deletedCount++;
        }
      }

      Logger.info('PlatformService', 'Database wiped successfully', { deletedCount });
      console.log(`[PlatformService] Wiped ${deletedCount} documents from all collections`);
      return { success: true, deletedCount };
    } catch (err) {
      console.error('[PlatformService] Error wiping database:', err);
      Logger.error('PlatformService', 'Failed to wipe database', { error: err.message });
      throw err;
    }
  },

  /**
   * Delete all collections and their documents (complete database reset).
   * This is the most destructive operation.
   */
  async deleteAllCollections() {
    try {
      const db = await getDb();
      const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      
      const collectionKeys = Object.keys(databaseSchema.collections);
      let deletedCount = 0;

      for (const key of collectionKeys) {
        const path = getCollectionPath(key);
        const snap = await getDocs(collection(db, path));
        
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, path, docSnap.id));
          deletedCount++;
        }
      }

      Logger.info('PlatformService', 'All collections deleted successfully', { deletedCount });
      console.log(`[PlatformService] Deleted ${deletedCount} documents from all collections`);
      return { success: true, deletedCount };
    } catch (err) {
      console.error('[PlatformService] Error deleting collections:', err);
      Logger.error('PlatformService', 'Failed to delete collections', { error: err.message });
      throw err;
    }
  },

  // Utility: get schema info
  getSchemaInfo() {
    const collections = Object.entries(databaseSchema.collections);
    const moduleCollections = Object.entries(databaseSchema.module_collections || {});
    const totalFields = collections.reduce(
      (sum, [, col]) => sum + Object.keys(col.fields).length, 0
    );
    return {
      rootCollection: databaseSchema.root_collection,
      rootDocument: databaseSchema.root_document,
      collectionCount: collections.length,
      moduleCollectionCount: moduleCollections.length,
      totalFields,
      collections: collections.map(([key, col]) => ({
        key,
        path: col.path,
        description: col.description,
        fieldCount: Object.keys(col.fields).length,
      })),
    };
  },
};

export default PlatformService;
