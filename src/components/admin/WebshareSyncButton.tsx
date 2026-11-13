'use client';

import React, { useState } from 'react';
import { CloudDownload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface SyncStats {
  totalFetched: number;
  added: number;
  updated: number;
  deactivated: number;
  totalActive: number;
}

interface WebshareSyncButtonProps {
  onSyncComplete?: (stats: SyncStats) => void;
  onToast?: (type: 'success' | 'error', title: string, message: string) => void;
  className?: string;
  variant?: 'primary' | 'outline';
}

export default function WebshareSyncButton({
  onSyncComplete,
  onToast,
  className = '',
  variant = 'primary',
}: WebshareSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [localToast, setLocalToast] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error', title: string, message: string) => {
    if (onToast) {
      onToast(type, title, message);
    } else {
      setLocalToast({ type, title, message });
      setTimeout(() => setLocalToast(null), 5000);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch('/api/admin/proxies/sync', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { stats } = data;
        const msg = `Synced ${stats.totalFetched} proxies (${stats.added} added, ${stats.updated} updated, ${stats.deactivated} deactivated).`;

        showNotification('success', 'Webshare Sync Complete', msg);

        if (onSyncComplete) {
          onSyncComplete(stats);
        }
      } else {
        showNotification(
          'error',
          'Webshare Sync Failed',
          data.error || 'Failed to download or synchronize proxies from Webshare API.'
        );
      }
    } catch (err: any) {
      showNotification(
        'error',
        'Network Error',
        err.message || 'Could not reach the proxy sync API endpoint.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Standalone Toast (if no parent onToast provided) */}
      {localToast && (
        <div className="fixed top-6 right-6 z-50 flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-3 max-w-sm w-full bg-[#1e0d30]/95 border-purple-500/40 text-purple-100 shadow-purple-950/50">
          {localToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <div className="font-semibold text-white">{localToast.title}</div>
            <div className="mt-0.5 text-purple-200/80 leading-relaxed">{localToast.message}</div>
          </div>
          <button
            onClick={() => setLocalToast(null)}
            className="text-purple-400 hover:text-white text-xs opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={
          className ||
          (variant === 'primary'
            ? 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-600 hover:from-purple-600 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 focus:ring-offset-[#0d0714] shadow-lg shadow-purple-950/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
            : 'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-purple-700/50 bg-[#1e0d30]/60 hover:bg-[#2b1245] text-purple-200 shadow-sm transition disabled:opacity-50')
        }
      >
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-fuchsia-300" />
            <span>Syncing from Webshare...</span>
          </>
        ) : (
          <>
            <CloudDownload className="w-4 h-4 text-fuchsia-300" />
            <span>Sync Proxies from Webshare</span>
          </>
        )}
      </button>
    </>
  );
}
