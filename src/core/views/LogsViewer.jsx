// ============================================================================
// LogsViewer — Full-featured log viewer for Platform Admins.
//
// ARCHITECTURE NOTE:
// Two tabs: System Logs and API Logs.
// System Logs: Level, Time, Source, User, Message, Result
// API Logs: Method, URL, Status Code, Response Time, User, Payloads
// Both have filtering, search, detail panel, real-time updates.
// ============================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Logger, Card, Button, PageHeader } from '@shared';
import {
  ScrollText, Search, Filter, Trash2, RefreshCw,
  X, Clock, Tag, Globe, User, CheckCircle2,
  XCircle, ArrowRightLeft
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

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('system');
  const [logs, setLogs] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    return source.filter((log) => {
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
  }, [logs, apiLogs, activeTab, levelFilter, sourceFilter, searchText]);

  const handleClear = useCallback(() => {
    if (activeTab === 'system') {
      Logger.clearSystemLogs();
    } else {
      Logger.clearApiLogs();
    }
    setSelectedLog(null);
  }, [activeTab]);

  const flushCount = Logger.getFlushBufferSize();

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
          ) : activeTab === 'system' ? (
            /* System Logs Table */
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-50 z-10">
                <tr className="border-b border-surface-200">
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-14">Level</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-20">Time</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-20">Source</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-28">User</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500">Message</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-16">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const lc = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                  const rc = RESULT_CONFIG[log.result] || RESULT_CONFIG.pending;
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <tr key={log.id} onClick={() => setSelectedLog(isSelected ? null : log)}
                      className={`border-b border-surface-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/50' : 'hover:bg-surface-50'}`}>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${lc.bg} ${lc.color}`}>{lc.label}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-surface-400 text-[10px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 font-semibold text-[10px]">{log.source}</span>
                      </td>
                      <td className="px-3 py-2 text-surface-500 truncate max-w-[120px] text-[10px]">{log.user || '—'}</td>
                      <td className="px-3 py-2 text-surface-700 truncate max-w-[300px]">{log.message}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${rc.bg} ${rc.color}`}>{log.result || '—'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* API Logs Table */
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-50 z-10">
                <tr className="border-b border-surface-200">
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-16">Method</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500">API URL</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-16">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-16">Time</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-24">User</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-surface-500 w-16">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const isSuccess = log.success;
                  return (
                    <tr key={log.id} onClick={() => setSelectedLog(isSelected ? null : log)}
                      className={`border-b border-surface-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/50' : 'hover:bg-surface-50'}`}>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.method === 'GET' ? 'bg-blue-50 text-blue-600' :
                          log.method === 'POST' ? 'bg-emerald-50 text-emerald-600' :
                          log.method === 'PUT' ? 'bg-amber-50 text-amber-600' :
                          log.method === 'DELETE' ? 'bg-rose-50 text-rose-600' :
                          'bg-surface-100 text-surface-500'
                        }`}>{log.method}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-surface-600 truncate max-w-[300px] text-[10px]">{log.url}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-surface-400 text-[10px]">{log.durationMs}ms</td>
                      <td className="px-3 py-2 text-surface-500 truncate max-w-[100px] text-[10px]">{log.user || '—'}</td>
                      <td className="px-3 py-2">
                        {isSuccess
                          ? <CheckCircle2 size={14} className="text-emerald-500" />
                          : <XCircle size={14} className="text-rose-500" />
                        }
                      </td>
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
                  <DetailRow icon={<Tag size={13} />} label="Level">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${LEVEL_CONFIG[selectedLog.level]?.bg} ${LEVEL_CONFIG[selectedLog.level]?.color}`}>
                      {selectedLog.level?.toUpperCase()}
                    </span>
                  </DetailRow>
                  <DetailRow icon={<Clock size={13} />} label="Time">
                    {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—'}
                  </DetailRow>
                  <DetailRow icon={<Tag size={13} />} label="Source">{selectedLog.source}</DetailRow>
                  <DetailRow icon={<User size={13} />} label="User">{selectedLog.user || '—'}</DetailRow>
                  <DetailRow icon={<CheckCircle2 size={13} />} label="Result">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${RESULT_CONFIG[selectedLog.result]?.bg || ''} ${RESULT_CONFIG[selectedLog.result]?.color || ''}`}>
                      {selectedLog.result || '—'}
                    </span>
                  </DetailRow>
                  <div>
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-xs text-surface-700 bg-surface-50 rounded-lg p-3">{selectedLog.message}</p>
                  </div>
                  {selectedLog.data && (
                    <div>
                      <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Data</p>
                      <pre className="text-[11px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <DetailRow icon={<ArrowRightLeft size={13} />} label="Method">
                    <span className="font-bold">{selectedLog.method}</span>
                  </DetailRow>
                  <div>
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">API URL</p>
                    <p className="text-xs text-surface-700 bg-surface-50 rounded-lg p-3 font-mono break-all">{selectedLog.url}</p>
                  </div>
                  <DetailRow icon={<Tag size={13} />} label="Status Code">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedLog.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {selectedLog.statusCode}
                    </span>
                  </DetailRow>
                  <DetailRow icon={<Clock size={13} />} label="Response Time">{selectedLog.durationMs}ms</DetailRow>
                  <DetailRow icon={<User size={13} />} label="User">{selectedLog.user || '—'}</DetailRow>
                  <DetailRow icon={<Clock size={13} />} label="Timestamp">
                    {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—'}
                  </DetailRow>
                  {selectedLog.requestPayload && (
                    <div>
                      <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Request Payload</p>
                      <pre className="text-[11px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.requestPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.responsePayload && (
                    <div>
                      <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Response Payload</p>
                      <pre className="text-[11px] text-surface-600 bg-surface-50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.responsePayload, null, 2)}
                      </pre>
                    </div>
                  )}
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
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-medium text-surface-700">{children}</span>
    </div>
  );
}
