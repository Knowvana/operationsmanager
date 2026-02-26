// ============================================================================
// GlobalLogStore — Application-level in-memory log cache for all users/browsers.
//
// ARCHITECTURE:
//   - Single shared cache for ALL log entries from ALL users and browsers
//   - Configurable max cache size (default 5000 entries — balances memory/retention)
//   - Entry-based flush: when cache reaches threshold, auto-flush to database
//   - No time-based flush — purely entry count driven
//   - Flush writes logs to Supabase PostgreSQL then clears the cache
//   - Manual flush available via flushToDatabase()
//   - Stats: cache count, DB count (tracked), max capacity
//
// Usage:
//   GlobalLogStore.addSystemLog(entry)   — push a log
//   GlobalLogStore.getStats()            — { cacheCount, dbCount, maxCache }
//   GlobalLogStore.flushToDatabase()     — write cache to DB + clear
//   GlobalLogStore.updateConfig({ maxCacheSize: 3000 })
// ============================================================================

let config = {
  maxCacheSize: 5000,        // Max entries in memory before auto-flush
  flushThreshold: 4500,      // Auto-flush when cache hits this count (90% of max)
};

const systemLogs = [];
const apiLogs = [];
let dbLogCount = 0;          // Tracks how many logs have been flushed to DB
let isFlushing = false;
const subscribers = new Set();

function notify() {
  subscribers.forEach(fn => {
    try { fn(); } catch (_) { /* ignore */ }
  });
}

function checkAutoFlush() {
  const total = systemLogs.length + apiLogs.length;
  if (total >= config.flushThreshold && !isFlushing) {
    GlobalLogStore.flushToDatabase();
  }
}

const GlobalLogStore = {
  addSystemLog(entry) {
    systemLogs.unshift(entry);
    if (systemLogs.length > config.maxCacheSize) systemLogs.pop();
    notify();
    checkAutoFlush();
  },

  addApiLog(entry) {
    apiLogs.unshift(entry);
    if (apiLogs.length > config.maxCacheSize) apiLogs.pop();
    notify();
    checkAutoFlush();
  },

  // Read logs from cache
  getSystemLogs() { return [...systemLogs]; },
  getApiLogs() { return [...apiLogs]; },

  // Filtering
  getSystemLogsByUser(email) { return systemLogs.filter(l => l.user === email); },
  getSystemLogsByLevel(level) { return systemLogs.filter(l => l.level === level); },

  // Clear cache only (does NOT write to DB)
  clearCache() {
    systemLogs.length = 0;
    apiLogs.length = 0;
    notify();
  },

  // Flush cache to database, then clear cache
  async flushToDatabase() {
    if (isFlushing) return { success: false, reason: 'Already flushing' };
    const toFlushSystem = [...systemLogs];
    const toFlushApi = [...apiLogs];
    const totalToFlush = toFlushSystem.length + toFlushApi.length;
    if (totalToFlush === 0) return { success: true, flushed: 0 };

    isFlushing = true;
    notify();
    try {
      const allLogs = [...toFlushSystem, ...toFlushApi];
      if (allLogs.length > 0) {
        try {
          // Dynamic import to avoid circular dependency with DatabaseService
          const { default: DatabaseService } = await import('./databaseService');
          const client = DatabaseService.getClient();

          if (client) {
            // Map log entries to PostgreSQL rows
            const rows = allLogs.map(log => ({
              level: log.level || 'info',
              message: log.message || '',
              type: log.apiUrl ? 'api' : 'system',
              source: log.source || '',
              user: log.user || 'system',
              data: log.data ? (typeof log.data === 'object' ? log.data : { raw: log.data }) : null,
              session_id: log.sessionId || '',
              result: log.result || '',
              api_url: log.apiUrl || null,
              api_method: log.apiMethod || null,
              api_status_code: log.apiStatusCode || null,
              api_response_ms: log.apiResponseTimeMs || null,
              api_request: log.apiRequestPayload || null,
              api_response: log.apiResponsePayload || null,
            }));

            // Batch insert (Supabase supports bulk insert)
            const { error } = await client.from('logs').insert(rows);
            if (error) {
              console.warn('[GlobalLogStore] PostgreSQL write failed, logs remain in cache:', error.message);
            } else {
              console.log(`[GlobalLogStore] Flushed ${totalToFlush} logs to PostgreSQL`);
            }
          } else {
            console.warn('[GlobalLogStore] Database not configured, logs remain in cache');
          }
        } catch (dbErr) {
          console.warn('[GlobalLogStore] Database write failed, logs remain in cache:', dbErr.message);
          // Don't throw — allow graceful degradation
        }
      }

      dbLogCount += totalToFlush;
      systemLogs.length = 0;
      apiLogs.length = 0;
      isFlushing = false;
      notify();
      return { success: true, flushed: totalToFlush };
    } catch (err) {
      isFlushing = false;
      notify();
      return { success: false, error: err.message };
    }
  },

  // Statistics
  getStats() {
    return {
      cacheSystemCount: systemLogs.length,
      cacheApiCount: apiLogs.length,
      cacheTotal: systemLogs.length + apiLogs.length,
      dbLogCount,
      maxCacheSize: config.maxCacheSize,
      flushThreshold: config.flushThreshold,
      isFlushing,
    };
  },

  // Configuration
  getConfig() { return { ...config }; },

  updateConfig(newConfig) {
    if (newConfig.maxCacheSize) {
      config.maxCacheSize = Math.max(100, Math.min(50000, newConfig.maxCacheSize));
      config.flushThreshold = Math.floor(config.maxCacheSize * 0.9);
    }
    if (newConfig.flushThreshold) {
      config.flushThreshold = Math.min(newConfig.flushThreshold, config.maxCacheSize);
    }
  },

  // Subscribe to changes
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

export default GlobalLogStore;
