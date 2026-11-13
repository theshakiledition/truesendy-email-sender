'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Mail,
  Plus,
  ShieldCheck,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Lock,
} from 'lucide-react';
import UserNavbar from '@/components/layout/UserNavbar';

export default function InboxesPage() {
  const [inboxes, setInboxes] = useState<any[]>([
    {
      id: 'demo-inbox-1',
      email: 'alex@startupreach.io',
      fromName: 'Alex Rivera',
      provider: 'GOOGLE',
      connectionStatus: 'CONNECTED',
      dailyLimit: 100,
      sentToday: 42,
      warmupStatus: 'ACTIVE',
      assignedProxy: '198.51.100.45:8080 (Webshare HTTP)',
      isDemo: true,
    },
    {
      id: 'demo-inbox-2',
      email: 'alex.rivera@growthlaunch.co',
      fromName: 'Alex R.',
      provider: 'OUTLOOK',
      connectionStatus: 'CONNECTED',
      dailyLimit: 120,
      sentToday: 78,
      warmupStatus: 'ACTIVE',
      assignedProxy: '198.51.100.82:8080 (Webshare HTTP)',
      isDemo: true,
    },
  ]);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [password, setPassword] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState(993);
  const [dailyLimit, setDailyLimit] = useState(100);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setConnectError(null);
    setConnectSuccess(null);

    try {
      const res = await fetch('/api/emails/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fromName,
          appPassword: password,
          smtpHost,
          smtpPort,
          imapHost,
          imapPort,
          dailyLimit,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify and connect email inbox.');
      }

      setConnectSuccess(`Successfully connected ${email} via proxy ${data.data?.proxyId ? 'pool' : 'direct'}!`);
      setShowConnectModal(false);
      // Reset form
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setConnectError(err.message || 'Verification failed. Please check credentials or app passwords.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0714] text-slate-100 flex flex-col font-sans">
      <UserNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-purple-950/80 border border-purple-800/40 text-purple-400 rounded-xl">
                <Mail className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">Connected Inboxes & Senders</h1>
            </div>
            <p className="text-xs text-purple-300/70 mt-1">
              Multi-inbox sender rotation with automated Webshare proxy pooling and warmup limits.
            </p>
          </div>

          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/60 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Connect New Inbox</span>
          </button>
        </div>

        {/* Deliverability & Proxy Pool Info Banner */}
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/30 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-white">Proxy Pool Protection Active: </span>
              <span>Every connected inbox is automatically assigned a dedicated proxy to prevent IP reputation contamination.</span>
            </div>
          </div>
          <span className="hidden md:inline-block font-mono text-[11px] text-fuchsia-400">
            HTTP Proxies: Webshare Pool
          </span>
        </div>

        {/* Connected Inboxes Table */}
        <div className="bg-[#14081f]/90 border border-purple-900/40 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-purple-200">
              <thead className="bg-[#110619] text-[11px] font-semibold uppercase text-purple-300/60 border-b border-purple-900/30 tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4">Sender Account</th>
                  <th scope="col" className="px-6 py-4">Connection Status</th>
                  <th scope="col" className="px-6 py-4">Dedicated Proxy</th>
                  <th scope="col" className="px-6 py-4">Daily Volume</th>
                  <th scope="col" className="px-6 py-4">Warmup Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20">
                {inboxes.map((inbox) => (
                  <tr key={inbox.id} className="hover:bg-purple-950/20 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        {inbox.email}
                        {inbox.isDemo && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-400 border border-purple-800/30">
                            Demo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-purple-400/60 mt-0.5">
                        Display Name: {inbox.fromName} • {inbox.provider}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {inbox.connectionStatus}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-mono text-[11px] text-purple-300">
                      <div className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span>{inbox.assignedProxy}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono">
                      <span className="text-white font-semibold">{inbox.sentToday}</span>
                      <span className="text-purple-400/60"> / {inbox.dailyLimit} sent today</span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950 text-fuchsia-300 border border-purple-800/40">
                        {inbox.warmupStatus} (100% Score)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Connect Inbox Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#160b22] border border-purple-900/50 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-purple-900/30">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-fuchsia-400" />
                <span>Connect Sender Inbox</span>
              </h2>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-purple-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {connectError && (
              <div className="mt-4 p-3 bg-red-950/60 border border-red-800/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{connectError}</span>
              </div>
            )}

            <form onSubmit={handleConnect} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-purple-200 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@yourcompany.com"
                  className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-purple-200 mb-1">Sender Name (From Name)</label>
                <input
                  type="text"
                  required
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-purple-200 mb-1">App Password / Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="App-specific 16-character password"
                  className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white placeholder-purple-400/40 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-purple-200 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="block text-purple-200 mb-1">SMTP Port</label>
                  <input
                    type="number"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-purple-200 mb-1">IMAP Host</label>
                  <input
                    type="text"
                    required
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="block text-purple-200 mb-1">IMAP Port</label>
                  <input
                    type="number"
                    required
                    value={imapPort}
                    onChange={(e) => setImapPort(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0d0714] border border-purple-900/60 rounded-xl text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white rounded-xl font-medium shadow-md shadow-purple-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Testing Connection & Allocating Proxy...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Link Inbox</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
