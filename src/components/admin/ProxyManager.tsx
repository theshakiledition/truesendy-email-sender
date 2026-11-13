'use client';

import React, { useState, useEffect } from 'react';
import WebshareSyncButton from './WebshareSyncButton';
import {
  Server,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  ShieldCheck,
  Search,
  Copy,
  Check,
  Power,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ProxyRecord {
  id: string;
  host: string;
  port: string;
  username: string | null;
  protocol: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    connectedEmails: number;
  };
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  title: string;
  message: string;
}

export default function ProxyManager() {
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [rawProxyText, setRawProxyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Show toast notification
  const addToast = (type: 'success' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Fetch proxies from backend
  const fetchProxies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/proxies');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProxies(json.data);
      } else {
        addToast('error', 'Fetch Error', json.error || 'Failed to load proxy inventory.');
      }
    } catch (err: any) {
      addToast('error', 'Network Error', err.message || 'Unable to communicate with the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProxies();
  }, []);

  // Handle bulk upload
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawProxyText.trim()) {
      addToast('error', 'Validation Error', 'Please paste at least one proxy in IP:Port:Username:Password format.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/proxies/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rawProxyText }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        addToast(
          'success',
          'Proxies Imported Successfully',
          json.message || `Imported ${json.insertedCount} new Webshare proxies.`
        );
        setRawProxyText('');
        await fetchProxies();
      } else {
        addToast('error', 'Import Failed', json.error || 'Failed to insert proxies.');
      }
    } catch (err: any) {
      addToast('error', 'Request Failed', err.message || 'Network error during upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Active/Inactive status toggle
  const handleToggleStatus = async (proxy: ProxyRecord) => {
    setTogglingId(proxy.id);
    const nextStatus = !proxy.isActive;

    try {
      const res = await fetch(`/api/admin/proxies/${proxy.id}`, {
        method: 'PATCH',
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setProxies((prev) =>
          prev.map((p) => (p.id === proxy.id ? { ...p, isActive: nextStatus } : p))
        );
        addToast(
          'success',
          'Status Updated',
          `Proxy ${proxy.host}:${proxy.port} is now ${nextStatus ? 'Active' : 'Inactive'}.`
        );
      } else {
        addToast('error', 'Toggle Failed', json.error || 'Could not update proxy status.');
      }
    } catch (err: any) {
      addToast('error', 'Toggle Error', err.message || 'Failed to toggle status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Detected line count in textarea
  const detectedCount = rawProxyText
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#')).length;

  const filteredProxies = proxies.filter(
    (p) =>
      p.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.port.includes(searchQuery) ||
      (p.username && p.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0d0714] text-slate-100 p-6 md:p-10 font-sans relative overflow-x-hidden">
      {/* Background Decorative Plum Glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-purple-900/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[450px] h-[350px] bg-fuchsia-950/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Toast Notification Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-3 ${
              toast.type === 'success'
                ? 'bg-[#1e0d30]/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/40'
                : 'bg-[#290a1f]/90 border-rose-500/40 text-rose-200 shadow-rose-950/40'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <div className="font-semibold text-white">{toast.title}</div>
              <div className="mt-0.5 text-slate-300/80 leading-relaxed">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white text-xs opacity-70"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/50 text-fuchsia-400 shadow-inner">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Proxy Pool Administration
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800/40">
                    Webshare Engine
                  </span>
                </h1>
                <p className="text-xs text-purple-300/60 mt-0.5">
                  Import, balance, and isolate outbound proxy IPs across sender inboxes.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WebshareSyncButton
              onSyncComplete={() => fetchProxies()}
              onToast={(type, title, message) => addToast(type, title, message)}
            />

            <button
              onClick={fetchProxies}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl border border-purple-800/40 bg-[#1a0e26] hover:bg-[#251436] text-purple-200 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-fuchsia-400' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* 1. UPLOAD SECTION */}
        <div className="bg-[#180c25]/80 border border-purple-900/40 rounded-2xl shadow-xl shadow-purple-950/40 backdrop-blur-md overflow-hidden">
          <div className="p-6 border-b border-purple-900/30 bg-[#1e0f30]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-fuchsia-400" />
                Bulk Import Webshare Proxies
              </h2>
              <p className="text-xs text-purple-300/60 mt-0.5">
                Paste your Webshare list. Expected format per line:{' '}
                <code className="bg-purple-950/80 text-fuchsia-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-purple-800/40">
                  IP:Port:Username:Password
                </code>
              </p>
            </div>

            {detectedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-950/90 text-purple-300 border border-purple-700/50 shadow-sm">
                <Sparkles className="w-3 h-3 text-fuchsia-400" />
                {detectedCount} {detectedCount === 1 ? 'proxy' : 'proxies'} ready
              </span>
            )}
          </div>

          <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
            <div className="relative">
              <textarea
                rows={6}
                value={rawProxyText}
                onChange={(e) => setRawProxyText(e.target.value)}
                placeholder={`185.199.228.220:7331:user_token:secret_pass
194.26.180.12:8080:user_token:secret_pass
45.142.122.88:9999:user_token:secret_pass`}
                className="w-full font-mono text-xs p-4 bg-[#12081c] border border-purple-900/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500 text-purple-100 placeholder:text-purple-400/20 resize-y leading-relaxed"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-xs text-purple-300/50">
                Protocols default to <span className="font-semibold text-purple-200">HTTP</span>. Duplicates are skipped automatically.
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !rawProxyText.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 focus:ring-offset-[#0d0714] shadow-lg shadow-purple-950/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Import...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import Proxies
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 2. PROXY POOL TABLE */}
        <div className="bg-[#180c25]/80 border border-purple-900/40 rounded-2xl shadow-xl shadow-purple-950/40 backdrop-blur-md overflow-hidden space-y-4">
          {/* Table Header Controls */}
          <div className="p-6 border-b border-purple-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-fuchsia-400" />
                Active Proxy Pool Inventory ({proxies.length})
              </h3>
              <p className="text-xs text-purple-300/60 mt-0.5">
                Live status, authentication credentials, and mailbox allocation balance.
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-purple-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search host, port, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 bg-[#12081c] border border-purple-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 text-purple-100 placeholder:text-purple-400/30"
              />
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-purple-200">
              <thead className="bg-[#14081f] text-[11px] font-semibold uppercase text-purple-300/70 border-y border-purple-900/30 tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">IP Address (Host)</th>
                  <th scope="col" className="px-6 py-3.5">Port</th>
                  <th scope="col" className="px-6 py-3.5">Protocol</th>
                  <th scope="col" className="px-6 py-3.5">Authentication</th>
                  <th scope="col" className="px-6 py-3.5 text-center">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-center">Connected Inboxes</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {isLoading && proxies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-purple-300/50">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-fuchsia-400" />
                      Loading proxy inventory...
                    </td>
                  </tr>
                ) : filteredProxies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-purple-300/50">
                      No proxies found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProxies.map((proxy) => {
                    const isToggling = togglingId === proxy.id;
                    const connectedCount = proxy._count?.connectedEmails || 0;

                    return (
                      <tr
                        key={proxy.id}
                        className="hover:bg-purple-950/30 transition-colors duration-150"
                      >
                        {/* Host / IP */}
                        <td className="px-6 py-4 font-mono font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>{proxy.host}</span>
                            <button
                              onClick={() => handleCopy(proxy.host, proxy.id)}
                              title="Copy IP"
                              className="text-purple-400/50 hover:text-purple-200 p-1 rounded"
                            >
                              {copiedId === proxy.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Port (String) */}
                        <td className="px-6 py-4 font-mono text-purple-300">
                          {proxy.port}
                        </td>

                        {/* Protocol */}
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/40 text-purple-300 font-mono text-[10px]">
                            {proxy.protocol || 'HTTP'}
                          </span>
                        </td>

                        {/* Username */}
                        <td className="px-6 py-4 font-mono text-purple-300/80">
                          {proxy.username ? (
                            <span>{proxy.username}</span>
                          ) : (
                            <span className="text-purple-400/40 italic">IP Whitelisted</span>
                          )}
                        </td>

                        {/* Status (Active/Inactive Toggle) */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleToggleStatus(proxy)}
                            disabled={isToggling}
                            title="Click to toggle Active / Inactive"
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${
                              proxy.isActive
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                                : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:bg-slate-800/60'
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  proxy.isActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                            )}
                            {proxy.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>

                        {/* Connected Inboxes Count */}
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              connectedCount > 0
                                ? 'bg-fuchsia-950/50 border-fuchsia-700/50 text-fuchsia-300'
                                : 'bg-purple-950/40 border-purple-800/30 text-purple-300/60'
                            }`}
                          >
                            <Mail className="w-3 h-3" />
                            {connectedCount} {connectedCount === 1 ? 'inbox' : 'inboxes'}
                          </span>
                        </td>

                        {/* Date Added */}
                        <td className="px-6 py-4 text-right text-[11px] text-purple-400/50">
                          {new Date(proxy.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
