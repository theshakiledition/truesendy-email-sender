import React from 'react';
import { Settings, ShieldCheck, Database, Key, Globe, Bell } from 'lucide-react';

export const metadata = {
  title: 'Global Settings | Superadmin Console',
  description: 'Global system configuration, security keys, and deliverability policies',
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-950/80 border border-purple-800/40 text-fuchsia-400 rounded-xl">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Global Platform Settings
            </h1>
          </div>
          <p className="text-xs text-purple-300/60 mt-1">
            System-wide security credentials, emergency stops, and default DNS CNAME configurations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deliverability & Safety */}
        <div className="bg-[#180c25]/80 border border-purple-900/40 rounded-2xl p-6 shadow-xl shadow-purple-950/40 backdrop-blur-md space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Deliverability & Emergency Brake
          </h2>
          <div className="space-y-3 text-xs text-purple-200">
            <div className="flex justify-between items-center py-2 border-b border-purple-900/30">
              <span className="text-purple-300/70">Emergency Brake Bounce Threshold</span>
              <span className="font-mono font-semibold text-fuchsia-400">8.0%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-purple-900/30">
              <span className="text-purple-300/70">Minimum Outbound Volume for Brake</span>
              <span className="font-mono font-semibold text-purple-200">50 Emails</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-purple-300/70">Humanized Jitter Delay Range</span>
              <span className="font-mono font-semibold text-emerald-400">180s - 540s (3 - 9 min)</span>
            </div>
          </div>
        </div>

        {/* Global DNS & Infrastructure */}
        <div className="bg-[#180c25]/80 border border-purple-900/40 rounded-2xl p-6 shadow-xl shadow-purple-950/40 backdrop-blur-md space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-fuchsia-400" />
            Whitelabel Tracking & Proxies
          </h2>
          <div className="space-y-3 text-xs text-purple-200">
            <div className="flex justify-between items-center py-2 border-b border-purple-900/30">
              <span className="text-purple-300/70">Default CNAME Target</span>
              <span className="font-mono font-semibold text-purple-200">track.truesendy.com</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-purple-900/30">
              <span className="text-purple-300/70">Webshare Sync Frequency</span>
              <span className="font-mono font-semibold text-fuchsia-400">Every 24 Hours (0 0 * * *)</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-purple-300/70">On-Demand TLS Proxy</span>
              <span className="font-mono font-semibold text-emerald-400">Caddy Server / ask API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
