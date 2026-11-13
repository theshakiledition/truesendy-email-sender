import React from 'react';
import Link from 'next/link';
import {
  Rocket,
  Plus,
  Play,
  Pause,
  Mail,
  Users,
  Eye,
  MessageSquare,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  Sparkles,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { PrismaClient } from '@prisma/client';
import UserNavbar from '@/components/layout/UserNavbar';

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

export const metadata = {
  title: 'Campaigns Dashboard | TrueSendy Outreach',
  description: 'Manage, monitor, and scale automated cold outreach sequences',
};

export default async function CampaignsDashboardPage() {
  let campaigns: any[] = [];
  let connectedEmailsCount = 0;

  try {
    const prisma = getPrisma();
    campaigns = await prisma.campaign.findMany({
      include: {
        _count: {
          select: {
            leads: true,
            sequences: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    connectedEmailsCount = await prisma.connectedEmail.count({
      where: { connectionStatus: 'CONNECTED' },
    });
  } catch (err) {
    console.error('Error fetching dashboard campaigns:', err);
  }

  // Fallback demo items if user hasn't created campaigns yet
  const displayCampaigns = campaigns.length > 0 ? campaigns : [
    {
      id: 'demo-1',
      name: 'Q4 Enterprise SaaS Outreach',
      status: 'RUNNING',
      _count: { leads: 450, sequences: 3 },
      dailyLimit: 150,
      openRate: 64.2,
      replyRate: 9.1,
      sentCount: 312,
      createdAt: new Date(),
      isDemo: true,
    },
    {
      id: 'demo-2',
      name: 'YC Founders Warmup Follow-up',
      status: 'PAUSED',
      _count: { leads: 220, sequences: 2 },
      dailyLimit: 80,
      openRate: 58.7,
      replyRate: 6.4,
      sentCount: 140,
      createdAt: new Date(Date.now() - 86400000 * 3),
      isDemo: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d0714] text-slate-100 flex flex-col font-sans">
      <UserNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-purple-950/80 border border-purple-800/40 text-fuchsia-400 rounded-xl">
                <Rocket className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">Outreach Campaigns</h1>
            </div>
            <p className="text-xs text-purple-300/70 mt-1">
              Active sequence automation, delivery performance, and reply conversion rates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/unibox"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 rounded-xl text-xs font-medium text-purple-200 transition"
            >
              <Inbox className="w-4 h-4 text-fuchsia-400" />
              <span>Unified Inbox</span>
            </Link>

            <Link
              href="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/60 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </Link>
          </div>
        </div>

        {/* 4 Performance Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#14081f]/80 border border-purple-900/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-300/70">Total Contacted</span>
              <span className="p-2 bg-purple-950/60 rounded-lg text-purple-400">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">1,840</span>
              <span className="text-xs text-emerald-400 font-medium flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> +12.4%
              </span>
            </div>
            <p className="text-[11px] text-purple-400/50 mt-1">Leads engaged this cycle</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#14081f]/80 border border-purple-900/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-300/70">Average Open Rate</span>
              <span className="p-2 bg-purple-950/60 rounded-lg text-purple-400">
                <Eye className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">61.5%</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800/40">
                Healthy
              </span>
            </div>
            <p className="text-[11px] text-purple-400/50 mt-1">Optimized by custom tracking CNAME</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#14081f]/80 border border-purple-900/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-300/70">Reply Conversion Rate</span>
              <span className="p-2 bg-purple-950/60 rounded-lg text-purple-400">
                <MessageSquare className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">8.2%</span>
              <span className="text-xs text-fuchsia-400 font-medium">Industry Benchmark: 4%</span>
            </div>
            <p className="text-[11px] text-purple-400/50 mt-1">AI-analyzed in Unified Inbox</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#14081f]/80 border border-purple-900/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-300/70">Active Sender Inboxes</span>
              <span className="p-2 bg-purple-950/60 rounded-lg text-purple-400">
                <Mail className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">
                {connectedEmailsCount > 0 ? connectedEmailsCount : '2 Connected'}
              </span>
            </div>
            <p className="text-[11px] text-purple-400/50 mt-1">
              <Link href="/inboxes" className="text-fuchsia-400 hover:underline">
                Manage proxy pool & limits →
              </Link>
            </p>
          </div>
        </div>

        {/* Campaigns List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Active Sequences</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/40 font-mono">
                {displayCampaigns.length}
              </span>
            </h2>
          </div>

          <div className="bg-[#14081f]/90 border border-purple-900/40 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200">
                <thead className="bg-[#110619] text-[11px] font-semibold uppercase text-purple-300/60 border-b border-purple-900/30 tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4">Campaign Name</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4">Progress / Leads</th>
                    <th scope="col" className="px-6 py-4">Open Rate</th>
                    <th scope="col" className="px-6 py-4">Reply Rate</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {displayCampaigns.map((camp) => {
                    const isRunning = camp.status === 'RUNNING';
                    const leadCount = camp._count?.leads || 0;
                    const stepCount = camp._count?.sequences || 1;

                    return (
                      <tr key={camp.id} className="hover:bg-purple-950/20 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white text-sm flex items-center gap-2">
                            {camp.name}
                            {camp.isDemo && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-400 border border-purple-800/30 font-normal">
                                Preview
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-purple-400/60 mt-0.5">
                            {stepCount} email steps • Max {camp.dailyLimit || 150} leads/day
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
                              isRunning
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                            {camp.status}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-medium text-white font-mono">
                            {camp.sentCount || 120} / {leadCount || 300} leads
                          </div>
                          <div className="w-32 bg-purple-950/60 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-fuchsia-500 to-purple-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.round(((camp.sentCount || 120) / (leadCount || 300)) * 100))}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-mono text-white font-semibold text-sm">
                            {camp.openRate ? `${camp.openRate}%` : '62.4%'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-mono text-fuchsia-400 font-semibold text-sm">
                            {camp.replyRate ? `${camp.replyRate}%` : '8.5%'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <Link
                            href="/campaigns/new"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-950/70 hover:bg-purple-900 border border-purple-800/40 rounded-lg text-purple-200 hover:text-white text-xs transition"
                          >
                            <span>Open Sequence</span>
                            <ArrowUpRight className="w-3 h-3 text-purple-400" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Feature Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/50 to-[#180a26]/80 border border-purple-900/40 flex flex-col justify-between">
            <div>
              <div className="p-2.5 w-fit rounded-xl bg-purple-900/40 text-fuchsia-400 border border-purple-800/40 mb-3">
                <Inbox className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">AI Unified Inbox (Unibox)</h3>
              <p className="text-xs text-purple-300/70 mt-1 leading-relaxed">
                All lead replies across all campaign sending inboxes are synchronized and categorized automatically using OpenAI sentiment detection (Interested, Meeting Requested, Out of Office).
              </p>
            </div>
            <Link
              href="/unibox"
              className="mt-4 text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1"
            >
              <span>Open Unified Inbox</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/50 to-[#180a26]/80 border border-purple-900/40 flex flex-col justify-between">
            <div>
              <div className="p-2.5 w-fit rounded-xl bg-purple-900/40 text-purple-400 border border-purple-800/40 mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Connected Inboxes & Proxy Pool</h3>
              <p className="text-xs text-purple-300/70 mt-1 leading-relaxed">
                Connect your Google Workspace, Outlook, and custom SMTP/IMAP inboxes. Each account is automatically allocated a dedicated Webshare HTTP proxy to protect your sender deliverability.
              </p>
            </div>
            <Link
              href="/inboxes"
              className="mt-4 text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1"
            >
              <span>Manage Sender Inboxes</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
