'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Sparkles,
  Inbox,
  Clock,
  Building,
  Mail,
  User,
  ArrowUpRight,
  CheckCircle,
  MoreVertical,
  Reply,
  Calendar,
  Tag,
  Paperclip,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface Lead {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  phone: string | null;
  website: string | null;
  lastRepliedAt: string;
}

interface Message {
  id: string;
  direction: 'OUTBOUND' | 'INBOUND';
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  timestamp: string;
  messageId?: string;
}

interface Conversation {
  lead: Lead;
  campaignId: string;
  campaignName: string;
  lastSnippet: string;
  lastTimestamp: string;
  messages: Message[];
}

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  totalReplies: number;
  conversations: Conversation[];
}

export default function UnifiedInbox() {
  const [campaignGroups, setCampaignGroups] = useState<CampaignGroup[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Reply Box State
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    fetchConversations();
  }, []);

  // Scroll to bottom of message thread on conversation switch
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/unibox');
      if (res.ok) {
        const json = await res.json();
        const campaigns: CampaignGroup[] = json.data?.campaigns || [];
        setCampaignGroups(campaigns);

        // Auto-select first conversation
        if (campaigns.length > 0 && campaigns[0].conversations.length > 0) {
          const first = campaigns[0].conversations[0];
          setSelectedConversation({
            ...first,
            campaignId: campaigns[0].campaignId,
            campaignName: campaigns[0].campaignName,
          });
        }
      } else {
        // Fallback mock data for immediate visual display if backend DB is empty
        loadMockData();
      }
    } catch {
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    const mockGroups: CampaignGroup[] = [
      {
        campaignId: 'c1',
        campaignName: 'Outbound Q4 - SaaS Founders',
        totalReplies: 2,
        conversations: [
          {
            lead: {
              id: 'lead-1',
              email: 'sarah.connor@acmetech.io',
              firstName: 'Sarah',
              lastName: 'Connor',
              companyName: 'AcmeTech AI',
              jobTitle: 'Head of Engineering',
              phone: '+1 (555) 234-5678',
              website: 'acmetech.io',
              lastRepliedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
            },
            campaignId: 'c1',
            campaignName: 'Outbound Q4 - SaaS Founders',
            lastSnippet: 'Hey Alex, thanks for reaching out. Yes, we are actually exploring cold email infra right now. Are you free Thursday at 2 PM EST for a quick call?',
            lastTimestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
            messages: [
              {
                id: 'm1',
                direction: 'OUTBOUND',
                senderName: 'Alex Vance',
                senderEmail: 'alex@outreachpro.com',
                subject: 'Quick question Sarah',
                body: "Hi Sarah,\n\nI noticed AcmeTech AI is scaling sales outreach. Are you open to a brief brainstorm on how teams eliminate spam filter issues using inbox rotation?\n\nBest,\nAlex",
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                id: 'm2',
                direction: 'INBOUND',
                senderName: 'Sarah Connor',
                senderEmail: 'sarah.connor@acmetech.io',
                subject: 'Re: Quick question Sarah',
                body: "Hey Alex, thanks for reaching out. Yes, we are actually exploring cold email infra right now. Are you free Thursday at 2 PM EST for a quick call?",
                timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
              },
            ],
          },
          {
            lead: {
              id: 'lead-2',
              email: 'marcus.vance@hypergrowth.co',
              firstName: 'Marcus',
              lastName: 'Vance',
              companyName: 'HyperGrowth',
              jobTitle: 'VP of Growth',
              phone: null,
              website: 'hypergrowth.co',
              lastRepliedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
            },
            campaignId: 'c1',
            campaignName: 'Outbound Q4 - SaaS Founders',
            lastSnippet: 'Sounds interesting. What are your pricing plans for 20 inboxes?',
            lastTimestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
            messages: [
              {
                id: 'm3',
                direction: 'OUTBOUND',
                senderName: 'Alex Vance',
                senderEmail: 'alex@outreachpro.com',
                subject: 'Inboxes for HyperGrowth',
                body: "Hi Marcus, saw HyperGrowth is hiring SDRs. Wanted to connect on how we handle automated warmup.",
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              },
              {
                id: 'm4',
                direction: 'INBOUND',
                senderName: 'Marcus Vance',
                senderEmail: 'marcus.vance@hypergrowth.co',
                subject: 'Re: Inboxes for HyperGrowth',
                body: "Sounds interesting. What are your pricing plans for 20 inboxes?",
                timestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
              },
            ],
          },
        ],
      },
    ];

    setCampaignGroups(mockGroups);
    if (mockGroups[0]?.conversations[0]) {
      setSelectedConversation(mockGroups[0].conversations[0]);
    }
  };

  // Flattened & Filtered Conversations List
  const allConversations: Conversation[] = campaignGroups.flatMap((group) =>
    group.conversations.map((c) => ({
      ...c,
      campaignId: group.campaignId,
      campaignName: group.campaignName,
    }))
  );

  const filteredConversations = allConversations.filter((conv) => {
    const matchesCampaign =
      selectedCampaignFilter === 'all' || conv.campaignId === selectedCampaignFilter;
    const nameMatch = `${conv.lead.firstName || ''} ${conv.lead.lastName || ''}`.toLowerCase();
    const matchesSearch =
      nameMatch.includes(searchQuery.toLowerCase()) ||
      (conv.lead.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lead.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCampaign && matchesSearch;
  });

  // Handle Manual Reply Dispatch
  const handleSendReply = async () => {
    if (!selectedConversation || !replyBody.trim()) return;

    setIsSending(true);
    setSendSuccess(false);

    try {
      const res = await fetch('/api/unibox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedConversation.lead.id,
          body: replyBody,
          subject: `Re: Follow up with ${selectedConversation.lead.firstName || 'there'}`,
        }),
      });

      const json = await res.json();

      const newMsg: Message = json.data || {
        id: `local-${Date.now()}`,
        direction: 'OUTBOUND',
        senderName: 'You',
        senderEmail: 'alex@outreachpro.com',
        subject: `Re: Conversation`,
        body: replyBody,
        timestamp: new Date().toISOString(),
      };

      // Optimistic append to local state
      const updatedMessages = [...selectedConversation.messages, newMsg];
      const updatedConv = {
        ...selectedConversation,
        messages: updatedMessages,
        lastSnippet: replyBody,
        lastTimestamp: new Date().toISOString(),
      };

      setSelectedConversation(updatedConv);
      setReplyBody('');
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / (60 * 1000));
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="h-screen w-full bg-[#08050E] text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Top Ambient Glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-purple-950/20 via-violet-900/10 to-transparent blur-3xl" />

      {/* Main Container Layout */}
      <div className="flex-1 flex overflow-hidden border-t border-[#1F1238]">
        {/* ========================================================================= */}
        {/* LEFT SIDEBAR: Replied Leads List                                          */}
        {/* ========================================================================= */}
        <aside className="w-96 border-r border-[#1F1238] bg-[#0C0717]/90 backdrop-blur-xl flex flex-col z-10">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[#1E1136] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.35)]">
                  <Inbox className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight">Unified Inbox</h2>
                  <p className="text-[11px] text-zinc-400">
                    {filteredConversations.length} replied leads
                  </p>
                </div>
              </div>

              <button
                onClick={fetchConversations}
                title="Refresh Inbox"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-[#160D26] hover:bg-[#201438] border border-[#2D1A4D] transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search leads, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#140B24] border border-[#2B184A] rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-purple-500/60 transition-all"
              />
            </div>

            {/* Campaign Filter Pill Selector */}
            {campaignGroups.length > 1 && (
              <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCampaignFilter('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCampaignFilter === 'all'
                      ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                      : 'bg-[#150D24] text-zinc-400 hover:text-zinc-200 border border-[#271542]'
                  }`}
                >
                  All Campaigns
                </button>
                {campaignGroups.map((g) => (
                  <button
                    key={g.campaignId}
                    onClick={() => setSelectedCampaignFilter(g.campaignId)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedCampaignFilter === g.campaignId
                        ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                        : 'bg-[#150D24] text-zinc-400 hover:text-zinc-200 border border-[#271542]'
                    }`}
                  >
                    {g.campaignName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#180E2B]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                <Inbox className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                No replied leads found.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversation?.lead.id === conv.lead.id;
                const leadName = `${conv.lead.firstName || ''} ${conv.lead.lastName || ''}`.trim() || conv.lead.email;
                const initials = (conv.lead.firstName?.[0] || conv.lead.email[0]).toUpperCase();

                return (
                  <div
                    key={conv.lead.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#1E1138] to-[#140A26] border-l-2 border-purple-500 shadow-[inset_0_0_20px_rgba(168,85,247,0.1)]'
                        : 'hover:bg-[#130B22] border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-b from-[#2E1654] to-[#1A0B33] border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-200 flex-shrink-0 shadow-sm">
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-semibold text-white truncate">{leadName}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
                            {formatRelativeTime(conv.lastTimestamp)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-[11px] text-zinc-400 mb-1.5">
                          <Building className="w-3 h-3 text-purple-400 flex-shrink-0" />
                          <span className="truncate">{conv.lead.companyName || 'No Company'}</span>
                        </div>

                        {/* Last Snippet */}
                        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                          {conv.lastSnippet || 'Replied to campaign'}
                        </p>

                        {/* Campaign Badge */}
                        <div className="mt-2 flex items-center space-x-1.5">
                          <span className="inline-flex items-center text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full truncate max-w-[190px]">
                            {conv.campaignName}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* MAIN PANE: Email Thread & Rich-Text Reply Box                             */}
        {/* ========================================================================= */}
        <section className="flex-1 flex flex-col bg-[#08050E] overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Top Contact Header */}
              <header className="px-6 py-4 border-b border-[#1E1136] bg-[#0E081A]/80 backdrop-blur-xl flex items-center justify-between z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600/30 to-fuchsia-600/20 border border-purple-500/40 flex items-center justify-center font-bold text-sm text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    {(selectedConversation.lead.firstName?.[0] || selectedConversation.lead.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-sm font-semibold text-white">
                        {`${selectedConversation.lead.firstName || ''} ${selectedConversation.lead.lastName || ''}`.trim() || selectedConversation.lead.email}
                      </h3>
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        <span>Replied</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-zinc-400 mt-0.5">
                      <span className="flex items-center space-x-1">
                        <Mail className="w-3 h-3 text-purple-400" />
                        <span>{selectedConversation.lead.email}</span>
                      </span>
                      {selectedConversation.lead.companyName && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="flex items-center space-x-1">
                            <Building className="w-3 h-3 text-purple-400" />
                            <span>{selectedConversation.lead.companyName}</span>
                          </span>
                        </>
                      )}
                      {selectedConversation.lead.jobTitle && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span>{selectedConversation.lead.jobTitle}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedConversation.lead.website && (
                    <a
                      href={`https://${selectedConversation.lead.website.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-[#170E28] hover:bg-[#23153D] border border-[#2E1A50] rounded-xl flex items-center space-x-1.5 transition-all"
                    >
                      <span>Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button className="px-3.5 py-1.5 text-xs font-medium text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-xl transition-all">
                    Mark as Booked Call
                  </button>
                </div>
              </header>

              {/* Thread History (Chat-like Email Cards) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedConversation.messages.map((msg) => {
                  const isOutbound = msg.direction === 'OUTBOUND';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-2xl rounded-2xl p-5 border transition-all shadow-lg ${
                          isOutbound
                            ? 'bg-gradient-to-b from-[#1C1033] to-[#140A26] border-purple-500/30 text-zinc-200'
                            : 'bg-gradient-to-b from-[#180F2E] to-[#100720] border-[#2F1B52] text-zinc-100 shadow-[0_0_25px_rgba(147,51,234,0.08)]'
                        }`}
                      >
                        {/* Header details */}
                        <div className="flex items-center justify-between text-xs pb-2 mb-3 border-b border-[#251642]">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-white">
                              {isOutbound ? `${msg.senderName} (You)` : msg.senderName}
                            </span>
                            <span className="text-zinc-500 text-[11px] font-mono">
                              &lt;{msg.senderEmail}&gt;
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Subject */}
                        <div className="text-xs font-semibold text-purple-300 font-mono mb-2">
                          {msg.subject}
                        </div>

                        {/* Body */}
                        <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-zinc-200">
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Rich-Text Reply Box Footer */}
              <footer className="p-5 border-t border-[#1E1136] bg-[#0C0717]/90 backdrop-blur-xl space-y-3">
                {/* Subject preview */}
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center space-x-2">
                    <Reply className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      Replying to{' '}
                      <strong className="text-white">
                        {selectedConversation.lead.firstName || selectedConversation.lead.email}
                      </strong>
                    </span>
                  </div>
                  {sendSuccess && (
                    <span className="flex items-center space-x-1 text-emerald-400 text-xs font-medium animate-fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>Reply sent and logged</span>
                    </span>
                  )}
                </div>

                {/* Textarea */}
                <div className="relative rounded-2xl bg-[#140B24] border border-[#2B184A] focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all p-3 shadow-inner">
                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Write your response to ${selectedConversation.lead.firstName || 'lead'}...`}
                    className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none leading-relaxed font-sans"
                  />

                  {/* Toolbar & Send Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#1F1238]">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyBody((prev) =>
                            prev + "Does 2:00 PM EST this Thursday work on your end? Here is my Calendly link: https://calendly.com/alex/15min"
                          )
                        }
                        className="text-[11px] text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-2.5 py-1 rounded-lg flex items-center space-x-1 transition-all"
                      >
                        <Calendar className="w-3 h-3 text-purple-400" />
                        <span>Insert Calendly Link</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setReplyBody(
                            (prev) =>
                              prev + "Thanks for your reply! Let me send over our PDF overview and pricing breakdown."
                          )
                        }
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 bg-[#1B112E] hover:bg-[#251840] border border-[#311E52] px-2.5 py-1 rounded-lg transition-all"
                      >
                        Quick Template
                      </button>
                    </div>

                    <button
                      onClick={handleSendReply}
                      disabled={isSending || !replyBody.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:opacity-95 shadow-[0_0_20px_rgba(147,51,234,0.35)] flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Reply</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs">
              <Inbox className="w-12 h-12 text-zinc-600 mb-3" />
              <p className="text-sm font-medium text-zinc-400">Select a replied lead to view thread</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
