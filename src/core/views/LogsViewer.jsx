// ============================================================================
// LogsViewer — Full-featured log viewer for Platform Admins.
//
// ARCHITECTURE NOTE:
// Two tabs: System Logs and API Logs.
// System Logs: Level, Time, Source, User, Message, Result
// API Logs: Method, URL, Status Code, Response Time, User, Payloads
// Both have filtering, search, detail panel, real-time updates.
// ============================================================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Logger, Card, Button, PageHeader } from '@shared';
import {
  ScrollText, Search, Filter, Trash2, RefreshCw,
  X, Clock, Tag, Globe, User, CheckCircle2,
  XCircle, ArrowRightLeft, ArrowUp, ArrowDown, GripVertical
} from 'lucide-react';

const LEVEL_CONFIG = {
  debug: { color: 'text-surface-400', bg: 'bg-surface-100', label: 'DEBUG' },
  info:  { color: 'text-blue-600', bg: 'bg-blue-50', label: 'INFO' },
  warn:  { color: 'text-amber-600', bg: 'bg-amber-50', label: 'WARN' },
  error: { color: 'text-rose-600', bg: 'bg-rose-50', label: 'ERROR' },
};

const RESULT_CONFIG = {
  success: { color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failure: { color: 'text-rose-600', bg: 'bg-rose-50' },
  warning: { color: 'text-amber-600', bg: 'bg-amber-50' },
  pending: { color: 'text-surface-400', bg: 'bg-surface-50' },
};

// Maps log source strings to the actual rendered component name in the UI.
// Add entries here as new components start logging.
const SOURCE_TO_COMPONENT = {
  'Overview':        'PlatformOverview',
  'Navigation':      'PlatformDashboard',
  'Settings':        'PlatformSettings',
  'Platform':        'DatabaseSetupWizard',
  'PlatformService': 'PlatformService',
  'Auth':            'SystemAdminLogin',
  'Firebase':        'FirebaseService',
  'API':             'APILayer',
  'Logger':          'LoggerService',
  'System':          'SystemCore',
  'Tenants':         'TenantManagement',
  'Modules':         'ModuleRegistry',
  'Users':           'UserManagement',
  'Security':        'SecuritySettings',
  'Database':        'DatabaseSetupWizard',
  'App':             'App',
};

// --- Sort value extraction for any column ---
function getSortValue(log, colId, tab) {
  if (tab === 'system') {
    switch (colId) {
      case 'level': return log.level || '';
      case 'time': return log.timestamp || '';
      case 'component': return SOURCE_TO_COMPONENT[log.source] || log.source || '';
      case 'source': return log.source || '';
      case 'user': return log.user || '';
      case 'message': return log.message || '';
      case 'result': return log.result || '';
      default: return '';
    }
  } else {
    switch (colId) {
      case 'method': return log.method || '';
      case 'url': return log.url || '';
      case 'status': return log.statusCode || 0;
      case 'respTime': return log.durationMs || 0;
      case 'timestamp': return log.timestamp || '';
      case 'user': return log.user || '';
      case 'result': return log.success ? 1 : 0;
      default: return '';
    }
  }
}

// --- Column Definitions ---
const SYSTEM_COLUMNS = [
  { id: 'level', label: 'Level', width: 70, minWidth: 50 },
  { id: 'time', label: 'Time', width: 95, minWidth: 70 },
  { id: 'component', label: 'Component', width: 130, minWidth: 80 },
  { id: 'source', label: 'Source', width: 90, minWidth: 60 },
  { id: 'user', label: 'User', width: 120, minWidth: 70 },
  { id: 'message', label: 'Message', width: 0, minWidth: 100 },
  { id: 'result', label: 'Result', width: 75, minWidth: 50 },
];

const API_COLUMNS = [
  { id: 'method', label: 'Method', width: 75, minWidth: 50 },
  { id: 'url', label: 'API URL', width: 0, minWidth: 120 },
  { id: 'status', label: 'Status', width: 70, minWidth: 50 },
  { id: 'respTime', label: 'Resp Time', width: 95, minWidth: 60 },
  { id: 'timestamp', label: 'Timestamp', width: 95, minWidth: 70 },
  { id: 'user', label: 'User', width: 120, minWidth: 70 },
  { id: 'result', label: 'Result', width: 65, minWidth: 50 },
];

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('system');
  const [logs, setLogs] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // --- Interactive column state ---
  const [sysColOrder, setSysColOrder] = useState(SYSTEM_COLUMNS.map(c => c.id));
  const [apiColOrder, setApiColOrder] = useState(API_COLUMNS.map(c => c.id));
  const [sysColWidths, setSysColWidths] = useState(() => Object.fromEntries(SYSTEM_COLUMNS.map(c => [c.id, c.width])));
  const [apiColWidths, setApiColWidths] = useState(() => Object.fromEntries(API_COLUMNS.map(c => [c.id, c.width])));
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [dragCol, setDragCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    const refresh = () => {
      setLogs([...Logger.getSystemLogs()]);
      setApiLogs([...Logger.getApiLogs()]);
    };
    refresh();
    if (autoRefresh) {
      const unsub = Logger.subscribe(refresh);
      return unsub;
    }
  }, [autoRefresh]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(logs.map((l) => l.source));
    return ['all', ...Array.from(sources).sort()];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const source = activeTab === 'system' ? logs : apiLogs;
    let filtered = source.filter((log) => {
      if (activeTab === 'system') {
        if (levelFilter !== 'all' && log.level !== levelFilter) return false;
        if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
      }
      if (searchText) {
        const q = searchText.toLowerCase();
        const searchable = activeTab === 'system'
          ? `${log.message} ${log.source} ${log.user || ''} ${log.result || ''}`
          : `${log.method} ${log.url} ${log.user || ''} ${log.statusCode}`;
        return searchable.toLowerCase().includes(q);
      }
      return true;
    });
    // Apply sort
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const valA = getSortValue(a, sortConfig.key, activeTab);
        const valB = getSortValue(b, sortConfig.key, activeTab);
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [logs, apiLogs, activeTab, levelFilter, sourceFilter, searchText, sortConfig]);

  const handleClear = useCallback(() => {
    if (activeTab === 'system') {
      Logger.clearSystemLogs();
    } else {
      Logger.clearApiLogs();
    }
    setSelectedLog(null);
  }, [activeTab]);

  const flushCount = Logger.getFlushBufferSize();

  // Current tab's column config
  const colDefs = activeTab === 'system' ? SYSTEM_COLUMNS : API_COLUMNS;
  const colOrder = activeTab === 'system' ? sysColOrder : apiColOrder;
  const setColOrder = activeTab === 'system' ? setSysColOrder : setApiColOrder;
  const colWidths = activeTab === 'system' ? sysColWidths : apiColWidths;
  const setColWidths = activeTab === 'system' ? setSysColWidths : setApiColWidths;
  const orderedCols = colOrder.map(id => colDefs.find(c => c.id === id)).filter(Boolean);

  // --- Sort handler ---
  const handleSort = useCallback((colId) => {
    setSortConfig(prev => ({
      key: colId,
      direction: prev.key === colId && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // --- Drag-drop reorder handlers ---
  const handleDragStart = useCallback((colId) => { setDragCol(colId); }, []);
  const handleDragOver = useCallback((e, colId) => { e.preventDefault(); setDragOverCol(colId); }, []);
  const handleDrop = useCallback((targetColId) => {
    if (!dragCol || dragCol === targetColId) { setDragCol(null); setDragOverCol(null); return; }
    setColOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(dragCol);
      const toIdx = newOrder.indexOf(targetColId);
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, dragCol);
      return newOrder;
    });
    setDragCol(null);
    setDragOverCol(null);
  }, [dragCol, setColOrder]);
  const handleDragEnd = useCallback(() => { setDragCol(null); setDragOverCol(null); }, []);

  // --- Resize handlers ---
  const handleResizeStart = useCallback((e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colId] || 100;
    const minW = colDefs.find(c => c.id === colId)?.minWidth || 40;
    const onMouseMove = (ev) => {
      const diff = ev.clientX - startX;
      const newW = Math.max(minW, startWidth + diff);
      setColWidths(prev => ({ ...prev, [colId]: newW }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths, colDefs, setColWidths]);

  // --- Cell content renderer for both system and API tables ---
  const renderCellContent = useCallback((log, colId, tab) => {
    if (tab === 'system') {
      switch (colId) {
        case 'level': {
          const lc = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
          return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${lc.bg} ${lc.color}`}>{lc.label}</span>;
        }
        case 'time':
          return <span className="font-mono text-surface-400 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>;
        case 'component': {
          const comp = SOURCE_TO_COMPONENT[log.source] || log.source || '—';
          return <span className="inline-block px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 font-semibold text-xs">{comp}</span>;
        }
        case 'source':
          return <span className="inline-block px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 font-semibold text-xs">{log.source}</span>;
        case 'user':
          return <span className="text-surface-500 text-xs">{log.user || '—'}</span>;
        case 'message':
          return <span className="text-surface-700">{log.message}</span>;
        case 'result': {
          const rc = RESULT_CONFIG[log.result] || RESULT_CONFIG.pending;
          return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${rc.bg} ${rc.color}`}>{log.result || '—'}</span>;
        }
        default: return '—';
      }
    } else {
      switch (colId) {
        case 'method':
          return (
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
              log.method === 'GET' ? 'bg-blue-50 text-blue-600' :
              log.method === 'POST' ? 'bg-emerald-50 text-emerald-600' :
              log.method === 'PUT' ? 'bg-amber-50 text-amber-600' :
              log.method === 'DELETE' ? 'bg-rose-50 text-rose-600' :
              'bg-surface-100 text-surface-500'
            }`}>{log.method}</span>
          );
        case 'url':
          return <span className="font-mono text-surface-600 text-xs">{log.url}</span>;
        case 'status': {
          const ok = log.success;
          return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{log.statusCode}</span>;
        }
        case 'respTime':
          return <span className="font-mono text-surface-500 text-xs">{log.durationMs}ms</span>;
        case 'timestamp':
          return <span className="font-mono text-surface-400 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>;
        case 'user':
          return <span className="text-surface-500 text-xs">{log.user || '—'}</span>;
        case 'result':
          return log.success
            ? <CheckCircle2 size={15} className="text-emerald-500" />
            : <XCircle size={15} className="text-rose-500" />;
        default: return '—';
      }
    }
  }, []);

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <PageHeader
        title="System Logs"
        subtitle={`${filteredLogs.length} entries | ${flushCount} pending flush`}
        icon={ScrollText}
      />

      {/* Tab Switcher + Toolbar */}
      <Card variant="flat" className="p-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tab Buttons */}
          <div className="flex items-center gap-1 mr-2">
            {[
              { id: 'system', label: 'System Logs', icon: ScrollText },
              { id: 'api', label: 'API Logs', icon: Globe },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedLog(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                      : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  <TabIcon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={activeTab === 'system' ? 'Search logs...' : 'Search API calls...'}
              className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Level Filter (system only) */}
          {activeTab === 'system' && (
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-surface-400" />
              {['all', 'debug', 'info', 'warn', 'error'].map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                    levelFilter === level
                      ? level === 'all' ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300'
                        : `${LEVEL_CONFIG[level]?.bg} ${LEVEL_CONFIG[level]?.color} ring-1 ring-current/20`
                      : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          )}

          {/* Source Filter (system only) */}
          {activeTab === 'system' && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-surface-200 rounded-lg bg-white text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {uniqueSources.map((src) => (
                <option key={src} value={src}>{src === 'all' ? 'All Sources' : src}</option>
              ))}
            </select>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg text-xs transition-colors ${autoRefresh ? 'text-emerald-600 bg-emerald-50' : 'text-surface-400 hover:bg-surface-100'}`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              <RefreshCw size={14} className={autoRefresh ? 'animate-spin-slow' : ''} />
            </button>
            <button onClick={handleClear} className="p-2 rounded-lg text-surface-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Clear logs">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table + Detail */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 overflow-y-auto border border-surface-200 rounded-lg bg-white">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-300">
              <ScrollText size={32} className="mb-3" />
              <p className="text-sm font-medium">No {activeTab === 'system' ? 'logs' : 'API calls'} match your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 bg-surface-50 z-10">
                <tr className="border-b border-surface-200">
                  {orderedCols.map((col) => {
                    const w = colWidths[col.id];
                    const isSorted = sortConfig.key === col.id;
                    const isDragTarget = dragOverCol === col.id && dragCol !== col.id;
                    return (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={() => handleDragStart(col.id)}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDrop={() => handleDrop(col.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleSort(col.id)}
                        className={`
                          text-left px-3 py-2.5 font-semibold text-surface-500 select-none relative group
                          ${dragCol === col.id ? 'opacity-40' : ''}
                          ${isDragTarget ? 'bg-brand-50' : ''}
                        `}
                        style={w > 0 ? { width: w, minWidth: col.minWidth } : { minWidth: col.minWidth }}
                      >
                        <div className="flex items-center gap-1 cursor-pointer">
                          <GripVertical size={10} className="text-surface-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                          <span className="truncate">{col.label}</span>
                          {isSorted && (
                            sortConfig.direction === 'asc'
                              ? <ArrowUp size={11} className="text-brand-500 flex-shrink-0" />
                              : <ArrowDown size={11} className="text-brand-500 flex-shrink-0" />
                          )}
                        </div>
                        {/* Resize handle */}
                        {w > 0 && (
                          <div
                            onMouseDown={(e) => handleResizeStart(e, col.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-300 transition-colors z-20"
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(isSelected ? null : log)}
                      className={`border-b border-surface-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/50' : 'hover:bg-surface-50'}`}
                    >
                      {orderedCols.map((col) => (
                        <td key={col.id} className="px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">
                          {renderCellContent(log, col.id, activeTab)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedLog && (
          <div className="w-80 flex-shrink-0 border border-surface-200 rounded-lg bg-white overflow-y-auto">
            <div className="p-4 border-b border-surface-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-surface-800">{activeTab === 'system' ? 'Log' : 'API'} Detail</h4>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded hover:bg-surface-100 text-surface-400"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              {activeTab === 'system' ? (
                <>
                  <DetailRow icon={<Tag size={14} />} label="Level">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${LEVEL_CONFIG[selectedLog.level]?.bg} ${LEVEL_CONFIG[selectedLog.level]?.color}`}>
                      {selectedLog.level?.toUpperCase()}
                    </span>
                  </DetailRow>
                  <DetailRow icon={<Clock size={14} />} label="Time">
                    {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—'}
                  </DetailRow>
                  <DetailRow icon={<Globe size={14} />} label="Component">
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-600">
                      {SOURCE_TO_COMPONENT[selectedLog.source] || selectedLog.source}
                    </span>
                  </DetailRow>
                  <DetailRow icon={<Tag size={14} />} label="Source">{selectedLog.source}</DetailRow>
                  <DetailRow icon={<User size={14} />} label="User">{selectedLog.user || '—'}</DetailRow>
                  <DetailRow icon={<CheckCircle2 size={14} />} label="Result">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${RESULT_CONFIG[selectedLog.result]?.bg || ''} ${RESULT_CONFIG[selectedLog.result]?.color || ''}`}>
                      {selectedLog.result || '—'}
                    </span>
                  </DetailRow>
                  <div>
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-sm text-surface-700 bg-surface-50 rounded-lg p-3">{selectedLog.message}</p>
                  </div>
                  {selectedLog.data && (
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Data (JSON)</p>
                      <pre className="text-xs text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <DetailRow icon={<ArrowRightLeft size={14} />} label="Method">
                    <span className="font-bold text-sm">{selectedLog.method}</span>
                  </DetailRow>
                  <div>
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">API URL</p>
                    <p className="text-sm text-surface-700 bg-surface-50 rounded-lg p-3 font-mono break-all">{selectedLog.url}</p>
                  </div>
                  <DetailRow icon={<Tag size={14} />} label="Response Code">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${selectedLog.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {selectedLog.statusCode}
                    </span>
                  </DetailRow>
                  <DetailRow icon={<Clock size={14} />} label="Response Time">{selectedLog.durationMs}ms</DetailRow>
                  <DetailRow icon={<CheckCircle2 size={14} />} label="Result">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${selectedLog.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {selectedLog.success ? 'Success' : 'Failure'}
                    </span>
                  </DetailRow>
                  <DetailRow icon={<User size={14} />} label="User">{selectedLog.user || '—'}</DetailRow>
                  <DetailRow icon={<Clock size={14} />} label="Timestamp">
                    {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—'}
                  </DetailRow>
                  <div>
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Request Body (JSON)</p>
                    <pre className="text-xs text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                      {selectedLog.requestPayload ? JSON.stringify(selectedLog.requestPayload, null, 2) : 'No request body'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Response Body (JSON)</p>
                    <pre className="text-xs text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                      {selectedLog.responsePayload ? JSON.stringify(selectedLog.responsePayload, null, 2) : 'No response body'}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-surface-400">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-sm font-medium text-surface-700">{children}</span>
    </div>
  );
}
