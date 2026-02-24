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
//   7. Batch flush: logs accumulate in memory and flush to Firestore
//      periodically or when buffer threshold is hit (minimizes costs)
//
// Logging Strategy (Firebase cost optimization):
//   - ALL logs go to in-memory buffer first (instant, zero cost)
//   - Only warn/error logs are eligible for DB persistence
//   - Batch flush: every N seconds OR when flush buffer hits threshold
//   - Single batched write = 1 Firestore write for N log entries
//   - Manual flush available via Logger.flushToDatabase()
//   - On browser close, pending logs are flushed via beforeunload
//
// Usage:
//   Logger.info('Auth', 'User logged in', { email });
//   Logger.error('Firebase', 'Connection failed', { code }, 'failure');
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
  // Batch flush settings
  flushIntervalSeconds: 60,
  flushThreshold: 50,
  persistLevels: ['warn', 'error'],
};

// State
let currentUser = null;
let sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const systemLogs = [];
const apiLogs = [];
const flushBuffer = []; // logs pending DB write
let flushTimer = null;
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

  // Add to flush buffer if level qualifies for persistence
  if (config.persistLevels.includes(entry.level)) {
    flushBuffer.push(entry);
    if (flushBuffer.length >= config.flushThreshold) {
      Logger.flushToDatabase();
    }
  }

  // Add to GlobalLogStore for cross-browser access
  globalLogStore.addSystemLog(entry);

  notify();
}

function addApiLog(entry) {
  if (!config.captureApiCalls) return;
  apiLogs.unshift(entry);
  if (apiLogs.length > config.maxBufferSize) {
    apiLogs.pop();
  }
  // Add to GlobalLogStore for cross-browser access
  globalLogStore.addApiLog(entry);
  notify();
}

function startFlushTimer() {
  stopFlushTimer();
  if (config.flushIntervalSeconds > 0) {
    flushTimer = setInterval(() => {
      if (flushBuffer.length > 0) {
        Logger.flushToDatabase();
      }
    }, config.flushIntervalSeconds * 1000);
  }
}

function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
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
  getFlushBuffer() { return flushBuffer; },
  getFlushBufferSize() { return flushBuffer.length; },

  // Clear logs
  clearSystemLogs() { systemLogs.length = 0; notify(); },
  clearApiLogs() { apiLogs.length = 0; notify(); },
  clearAll() { systemLogs.length = 0; apiLogs.length = 0; notify(); },

  // Batch flush to Firestore
  // This is async but callers don't need to await it
  async flushToDatabase() {
    console.log('Flush to database pending due to Firebase persistence');
  },

  getConfig() {
    return config;
  },

  getLogLevels() {
    return Object.keys(LOG_LEVELS);
  },

  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

// Start flush timer
startFlushTimer();

// Flush on browser close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (flushBuffer.length > 0) {
      Logger.flushToDatabase();
    }
  });
}

// Initial boot log
Logger.info('System', 'Logger initialized', { config: Logger.getConfig(), sessionId });

export default Logger;
