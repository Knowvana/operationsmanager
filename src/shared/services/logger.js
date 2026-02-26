// ============================================================================
// Logger — Centralized logging service for the entire platform.
//
// ARCHITECTURE NOTE:
// This is the ONLY way to log in this application. Never use console.log
// directly — always use Logger. This gives us:
//   1. Configurable log levels (debug, info, warn, error)
//   2. In-memory log buffer for the RightPanel's System Logs tab
//   3. Structured log entries with timestamps, source, user, result
//   4. Enhanced API tracking: URL, method, status, response time, payloads
//   5. Admin-configurable: App admins control what gets logged
//   6. Subscriber pattern: UI components can subscribe to new logs
//   7. Batch flush: logs accumulate in memory and flush to PostgreSQL
//      periodically or when buffer threshold is hit
//
// Logging Strategy:
//   - ALL logs go to in-memory buffer first (instant, zero cost)
//   - Only warn/error logs are eligible for DB persistence
//   - Batch flush: every N seconds OR when flush buffer hits threshold
//   - Single batched insert to PostgreSQL via Supabase
//   - Manual flush available via Logger.flushToDatabase()
//   - On browser close, pending logs are flushed via beforeunload
//
// Usage:
//   Logger.info('Auth', 'User logged in', { email });
//   Logger.error('Database', 'Connection failed', { code }, 'failure');
//   Logger.api('GET', '/Tenants', 200, 45, { req }, { res });
//   Logger.setUser('admin@knowvana.com');
// ============================================================================

import globalLogStore from './globalLogStore';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// Default configuration — App Admins can change this at runtime
let config = {
  minLevel: 'debug',
  maxBufferSize: 500,
  consoleOutput: true,
  captureApiCalls: true,
  captureTimestamps: true,
  persistLevels: ['warn', 'error'],
};

// State
let currentUser = null;
let sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const systemLogs = [];
const apiLogs = [];
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => {
    try { fn(); } catch (_) { /* ignore subscriber errors */ }
  });
}

function shouldLog(level) {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

function createEntry(level, source, message, data = null, result = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: config.captureTimestamps ? new Date().toISOString() : null,
    level,
    source,
    message,
    user: currentUser || 'system',
    result: result || (level === 'error' ? 'failure' : 'success'),
    sessionId,
    data,
  };
}

function addSystemLog(entry) {
  systemLogs.unshift(entry);
  if (systemLogs.length > config.maxBufferSize) {
    systemLogs.pop();
  }

  if (config.consoleOutput) {
    const consoleFn = entry.level === 'error' ? console.error
      : entry.level === 'warn' ? console.warn
      : entry.level === 'debug' ? console.debug
      : console.log;
    consoleFn(
      `[${entry.level.toUpperCase()}] [${entry.source}] [${entry.user}]`,
      entry.message,
      entry.result ? `(${entry.result})` : '',
      entry.data || ''
    );
  }

  // Push to GlobalLogStore (application-wide cache for all users/browsers)
  try { globalLogStore.addSystemLog(entry); } catch (_) { /* ignore */ }

  notify();
}

function addApiLog(entry) {
  if (!config.captureApiCalls) return;
  apiLogs.unshift(entry);
  if (apiLogs.length > config.maxBufferSize) {
    apiLogs.pop();
  }
  // Push to GlobalLogStore (application-wide cache for all users/browsers)
  try { globalLogStore.addApiLog(entry); } catch (_) { /* ignore */ }
  notify();
}


// --- Public API ---

const Logger = {
  // System log methods — all accept optional result param
  debug(source, message, data, result) {
    if (!shouldLog('debug')) return;
    addSystemLog(createEntry('debug', source, message, data, result));
  },

  info(source, message, data, result) {
    if (!shouldLog('info')) return;
    addSystemLog(createEntry('info', source, message, data, result));
  },

  warn(source, message, data, result) {
    if (!shouldLog('warn')) return;
    addSystemLog(createEntry('warn', source, message, data, result || 'warning'));
  },

  error(source, message, data, result) {
    if (!shouldLog('error')) return;
    addSystemLog(createEntry('error', source, message, data, result || 'failure'));
  },

  // Enhanced API call tracker
  api(method, url, statusCode, durationMs, requestPayload = null, responsePayload = null) {
    const success = statusCode >= 200 && statusCode < 400;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      method,
      url,
      statusCode,
      durationMs,
      success,
      user: currentUser || 'system',
      result: success ? 'success' : 'failure',
      requestPayload,
      responsePayload,
    };
    addApiLog(entry);

    // Also log as system log for unified view
    const level = success ? 'debug' : 'error';
    if (shouldLog(level)) {
      const sysEntry = createEntry(
        level,
        'API',
        `${method} ${url} → ${statusCode} (${durationMs}ms)`,
        { requestPayload, responsePayload },
        success ? 'success' : 'failure'
      );
      sysEntry.apiUrl = url;
      sysEntry.apiMethod = method;
      sysEntry.apiStatusCode = statusCode;
      sysEntry.apiResponseTimeMs = durationMs;
      sysEntry.apiRequestPayload = requestPayload;
      sysEntry.apiResponsePayload = responsePayload;
      addSystemLog(sysEntry);
    }
  },

  // Set current user context (called on login)
  setUser(email) {
    currentUser = email;
  },

  getUser() {
    return currentUser;
  },

  getSessionId() {
    return sessionId;
  },

  // Read logs
  getSystemLogs() { return systemLogs; },
  getApiLogs() { return apiLogs; },
  getFlushBuffer() { return []; },
  getFlushBufferSize() { return globalLogStore.getStats().cacheTotal; },

  // Clear logs
  clearSystemLogs() { systemLogs.length = 0; notify(); },
  clearApiLogs() { apiLogs.length = 0; notify(); },
  clearAll() { systemLogs.length = 0; apiLogs.length = 0; notify(); },

  // Flush application cache to database (delegates to GlobalLogStore)
  async flushToDatabase() {
    return globalLogStore.flushToDatabase();
  },

  getConfig() {
    return { ...config, ...globalLogStore.getConfig() };
  },

  updateConfig(newConfig) {
    if (newConfig.minLevel) config.minLevel = newConfig.minLevel;
    if (newConfig.maxBufferSize) config.maxBufferSize = newConfig.maxBufferSize;
    if (newConfig.consoleOutput !== undefined) config.consoleOutput = newConfig.consoleOutput;
    if (newConfig.maxCacheSize || newConfig.flushThreshold) {
      globalLogStore.updateConfig(newConfig);
    }
  },

  getLogLevels() {
    return Object.keys(LOG_LEVELS);
  },

  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

// Flush on browser close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    Logger.flushToDatabase();
  });
}

// Initial boot log
Logger.info('System', 'Logger initialized', { config: Logger.getConfig(), sessionId });

export default Logger;
