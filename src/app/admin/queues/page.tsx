/**
 * src/app/admin/queues/page.tsx
 * Superadmin Bull-Board Queue Telemetry & Live Job Inspector.
 */

'use client';

import React, { useState } from 'react';
import { Layers, RefreshCw, ExternalLink, ShieldCheck, Activity, Terminal } from 'lucide-react';

export default function AdminQueuesPage() {
  const [iframeKey, setIframeKey] = useState(1);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-950/80 border border-purple-800/40 text-fuchsia-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              System Queues Telemetry
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-950 text-fuchsia-300 border border-purple-800/40">
                Bull-Board Live
              </span>
            </h1>
          </div>
          <p className="text-xs text-purple-300/60 mt-1">
            Real-time BullMQ v6 inspector for outreach dispatchers, cron schedulers, and retry buffers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-purple-800/40 bg-[#1a0e26] hover:bg-[#251436] text-purple-200 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-fuchsia-400" />
            Reload Board
          </button>
          <a
            href="/api/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-950/50 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Standalone Window
          </a>
        </div>
      </div>

      {/* Queue Info Pill Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-xl bg-[#180c25]/80 border border-purple-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white font-mono">send-email</span>
          </div>
          <span className="text-[11px] text-purple-300/60">Worker Concurrency: 5</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#180c25]/80 border border-purple-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
            <span className="font-semibold text-white font-mono">system-tasks</span>
          </div>
          <span className="text-[11px] text-purple-300/60">Scheduler: 0 0 * * *</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#180c25]/80 border border-purple-900/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white font-mono">inbox-monitor</span>
          </div>
          <span className="text-[11px] text-purple-300/60">Poll Interval: 60s</span>
        </div>
      </div>

      {/* Embedded Bull-Board Panel */}
      <div className="rounded-2xl border border-purple-900/40 bg-[#160a24]/90 overflow-hidden shadow-2xl shadow-purple-950/50 h-[750px] relative">
        <iframe
          key={iframeKey}
          src="/api/admin/queues"
          title="Bull-Board Queue Inspector"
          className="w-full h-full border-0 bg-[#0d0714]"
        />
      </div>
    </div>
  );
}
