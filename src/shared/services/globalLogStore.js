// ============================================================================
// GlobalLogStore — Server-side in-memory log storage for all browsers/users
//
// This service maintains a global log store that persists logs from all
// browser sessions and users. Unlike the Logger service which stores logs
// in each browser's memory, this store is shared across all clients.
//
// Features:
//   - Stores system logs from all users and browsers
//   - Stores API logs from all requests
//   - Maintains a maximum buffer size to prevent memory overflow
//   - Provides filtering and retrieval methods
//   - Subscribers can listen for new log entries
//
// NOTE: This is in-memory storage. In production, this would be backed by
// a database or message queue for persistence across server restarts.
// ============================================================================

const MAX_LOGS = 10000; // Maximum logs to keep in memory
const systemLogs = [];
const apiLogs = [];
const subscribers = new Set();

function notify() {
  subscribers.forEach(fn => fn());
}

// Add a system log to the global store
function addSystemLog(entry) {
  systemLogs.unshift(entry);
  if (systemLogs.length > MAX_LOGS) {
    systemLogs.pop();
  }
  notify();
}

// Add an API log to the global store
function addApiLog(entry) {
  apiLogs.unshift(entry);
  if (apiLogs.length > MAX_LOGS) {
    apiLogs.pop();
  }
  notify();
}

const GlobalLogStore = {
  // Add logs from Logger
  addSystemLog(entry) {
    addSystemLog(entry);
  },

  addApiLog(entry) {
    addApiLog(entry);
  },

  // Read logs
  getSystemLogs() {
    return [...systemLogs];
  },

  getApiLogs() {
    return [...apiLogs];
  },

  getAllLogs() {
    return {
      system: [...systemLogs],
      api: [...apiLogs],
    };
  },

  // Get logs with filtering
  getSystemLogsByUser(email) {
    return systemLogs.filter(log => log.user === email);
  },

  getSystemLogsBySource(source) {
    return systemLogs.filter(log => log.source === source);
  },

  getSystemLogsByLevel(level) {
    return systemLogs.filter(log => log.level === level);
  },

  // Get recent logs
  getRecentSystemLogs(count = 100) {
    return systemLogs.slice(0, count);
  },

  getRecentApiLogs(count = 100) {
    return apiLogs.slice(0, count);
  },

  // Clear logs
  clearSystemLogs() {
    systemLogs.length = 0;
    notify();
  },

  clearApiLogs() {
    apiLogs.length = 0;
    notify();
  },

  clearAll() {
    systemLogs.length = 0;
    apiLogs.length = 0;
    notify();
  },

  // Get statistics
  getStats() {
    return {
      systemLogCount: systemLogs.length,
      apiLogCount: apiLogs.length,
      totalLogCount: systemLogs.length + apiLogs.length,
      maxCapacity: MAX_LOGS,
    };
  },

  // Subscribe to changes
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

export default GlobalLogStore;
