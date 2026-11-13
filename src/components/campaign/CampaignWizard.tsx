'use client';

import React, { useState, useRef } from 'react';
import {
  Users,
  GitBranch,
  Calendar,
  Sliders,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Info,
  HelpCircle,
  ShieldCheck,
  Send,
  Eye,
  CornerDownRight,
  ArrowRight,
  Check,
} from 'lucide-react';

// Types
type TabType = 'leads' | 'sequences' | 'schedule' | 'options';

interface LeadColumnMapping {
  csvHeader: string;
  sampleValue: string;
  mappedField: string;
}

interface SequenceStep {
  id: string;
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  subject: string;
  body: string;
  threadReply: boolean;
}

interface CampaignSchedule {
  timezone: string;
  days: number[]; // 1=Mon, 7=Sun
  startTime: string;
  endTime: string;
  dailyLimit: number;
  minIntervalSeconds: number;
}

interface CampaignOptions {
  trackOpens: boolean;
  trackClicks: boolean;
  stopOnReply: boolean;
  stopOnAutoReply: boolean;
  sendAsPlaintext: boolean;
  trackingDomain: string;
}

const DB_FIELD_OPTIONS = [
  { value: 'email', label: 'Email Address *', required: true },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'companyName', label: 'Company Name' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'website', label: 'Company Website' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'linkedinUrl', label: 'LinkedIn Profile' },
  { value: 'customVariable', label: 'Custom Variable (JSON)' },
  { value: 'ignore', label: '-- Do Not Import --' },
];

const VARIABLE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{company_name}}', label: 'Company' },
  { tag: '{{job_title}}', label: 'Job Title' },
  { tag: '{{website}}', label: 'Website' },
];

const SPINTAX_TEMPLATES = [
  '{Hi|Hello|Hey}',
  '{hope you are doing well|reaching out because|wanted to touch base}',
  '{Best|Cheers|Regards}',
];

export default function CampaignWizard() {
  const [activeTab, setActiveTab] = useState<TabType>('leads');
  const [campaignName, setCampaignName] = useState('Outbound Q4 - SaaS Founders');

  // Leads State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [detectedRowCount, setDetectedRowCount] = useState<number>(0);
  const [columnMappings, setColumnMappings] = useState<LeadColumnMapping[]>([
    { csvHeader: 'work_email', sampleValue: 'alex@cloudtech.io', mappedField: 'email' },
    { csvHeader: 'first_name', sampleValue: 'Alex', mappedField: 'firstName' },
    { csvHeader: 'last_name', sampleValue: 'Vance', mappedField: 'lastName' },
    { csvHeader: 'company', sampleValue: 'CloudTech Inc', mappedField: 'companyName' },
    { csvHeader: 'title', sampleValue: 'Founder & CEO', mappedField: 'jobTitle' },
    { csvHeader: 'icebreaker', sampleValue: 'Saw your recent post on distributed queues', mappedField: 'customVariable' },
  ]);

  // Sequences State
  const [sequences, setSequences] = useState<SequenceStep[]>([
    {
      id: 'step-1',
      stepNumber: 1,
      delayDays: 0,
      delayHours: 0,
      subject: '{Quick question|Hello} {{first_name}}',
      body: 'Hi {{first_name}},\n\nI noticed {{company_name}} is scaling outreach infrastructure.\n\n{Would you be open to a 10-minute chat|Are you available for a brief brainstorm} on how teams optimize inbox deliverability?\n\nBest,\nAlex',
      threadReply: false,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      delayDays: 3,
      delayHours: 0,
      subject: 'Re: {{first_name}}',
      body: 'Hi {{first_name}},\n\nJust bumping this in case it got buried under your inbox volume. Would love to share our quick benchmark with {{company_name}}.\n\nCheers,\nAlex',
      threadReply: true,
    },
  ]);
  const [activeSequenceIndex, setActiveSequenceIndex] = useState(0);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Schedule State
  const [schedule, setSchedule] = useState<CampaignSchedule>({
    timezone: 'America/New_York',
    days: [1, 2, 3, 4, 5], // Mon to Fri
    startTime: '09:00',
    endTime: '17:30',
    dailyLimit: 150,
    minIntervalSeconds: 240, // 4 mins
  });

  // Options State
  const [options, setOptions] = useState<CampaignOptions>({
    trackOpens: true,
    trackClicks: false,
    stopOnReply: true,
    stopOnAutoReply: true,
    sendAsPlaintext: false,
    trackingDomain: 'track.outreachflow.io',
  });

  // ----------------------------------------------------------------------------
  // Drag & Drop / CSV Parsing Simulation
  // ----------------------------------------------------------------------------
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCsvSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCsvSelect = (file: File) => {
    setCsvFile(file);
    setDetectedRowCount(1480); // Simulated count
  };

  const handleMappingChange = (index: number, newField: string) => {
    const updated = [...columnMappings];
    updated[index].mappedField = newField;
    setColumnMappings(updated);
  };

  const isEmailMapped = columnMappings.some((m) => m.mappedField === 'email');

  // ----------------------------------------------------------------------------
  // Sequence Handlers
  // ----------------------------------------------------------------------------
  const addSequenceStep = () => {
    const nextStepNum = sequences.length + 1;
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      stepNumber: nextStepNum,
      delayDays: 2,
      delayHours: 0,
      subject: `Re: Follow up for {{first_name}}`,
      body: `Hey {{first_name}},\n\nAny thoughts on my previous note?\n\nBest,\nAlex`,
      threadReply: true,
    };
    setSequences([...sequences, newStep]);
    setActiveSequenceIndex(sequences.length);
  };

  const removeSequenceStep = (indexToRemove: number) => {
    if (sequences.length <= 1) return;
    const filtered = sequences.filter((_, idx) => idx !== indexToRemove);
    const renumbered = filtered.map((item, idx) => ({ ...item, stepNumber: idx + 1 }));
    setSequences(renumbered);
    setActiveSequenceIndex(Math.max(0, indexToRemove - 1));
  };

  const updateCurrentSequence = (key: keyof SequenceStep, val: any) => {
    const updated = [...sequences];
    updated[activeSequenceIndex] = {
      ...updated[activeSequenceIndex],
      [key]: val,
    };
    setSequences(updated);
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);

    updateCurrentSequence('body', newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 10);
  };

  // ----------------------------------------------------------------------------
  // Schedule Helpers
  // ----------------------------------------------------------------------------
  const toggleDay = (dayNum: number) => {
    const days = [...schedule.days];
    if (days.includes(dayNum)) {
      setSchedule({ ...schedule, days: days.filter((d) => d !== dayNum) });
    } else {
      setSchedule({ ...schedule, days: [...days, dayNum].sort() });
    }
  };

  return (
    <div className="min-h-screen bg-[#07050A] text-zinc-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {/* Top Ambient Glow Gradient */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-purple-950/20 via-violet-900/10 to-transparent blur-3xl" />

      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#231738]/80 bg-[#0B0714]/80 backdrop-blur-xl px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.35)]">
              <Send className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="bg-transparent font-semibold text-lg text-white tracking-tight focus:outline-none focus:ring-1 focus:ring-purple-500/50 rounded px-1 transition-all"
                />
              </div>
              <p className="text-xs text-zinc-400 pl-1">Outreach Campaign Setup • Instantly Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-[#1A1229] hover:bg-[#251B3B] border border-[#342454] rounded-lg transition-all">
              Save Draft
            </button>
            <button className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:opacity-95 shadow-[0_0_25px_rgba(147,51,234,0.35)] rounded-lg flex items-center space-x-2 transition-all">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Campaign</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col space-y-6">
        {/* Navigation Tabs (Plum Segmented Control) */}
        <div className="bg-[#110A1F]/90 p-1.5 rounded-2xl border border-[#271840] backdrop-blur-xl flex items-center justify-between shadow-2xl">
          <div className="grid grid-cols-4 gap-2 w-full">
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'leads'
                  ? 'bg-gradient-to-r from-violet-600/30 to-purple-600/20 text-purple-200 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1C1133]/50 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4 text-purple-400" />
              <span>1. Leads</span>
              {detectedRowCount > 0 && (
                <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-mono">
                  {detectedRowCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sequences')}
              className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'sequences'
                  ? 'bg-gradient-to-r from-violet-600/30 to-purple-600/20 text-purple-200 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1C1133]/50 border border-transparent'
              }`}
            >
              <GitBranch className="w-4 h-4 text-fuchsia-400" />
              <span>2. Sequences</span>
              <span className="text-[11px] bg-fuchsia-500/20 text-fuchsia-300 px-2 py-0.5 rounded-full font-mono">
                {sequences.length} steps
              </span>
            </button>

            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'schedule'
                  ? 'bg-gradient-to-r from-violet-600/30 to-purple-600/20 text-purple-200 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1C1133]/50 border border-transparent'
              }`}
            >
              <Calendar className="w-4 h-4 text-violet-400" />
              <span>3. Schedule</span>
            </button>

            <button
              onClick={() => setActiveTab('options')}
              className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'options'
                  ? 'bg-gradient-to-r from-violet-600/30 to-purple-600/20 text-purple-200 border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1C1133]/50 border border-transparent'
              }`}
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>4. Options</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Leads Upload & Column Mapping */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            {/* Upload Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
                isDragging
                  ? 'border-purple-400 bg-purple-950/20 shadow-[0_0_40px_rgba(168,85,247,0.25)]'
                  : 'border-[#2D1B4D] hover:border-purple-500/40 bg-[#0F0A1C]/80'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                id="csvInput"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCsvSelect(e.target.files[0])}
              />
              <label htmlFor="csvInput" className="cursor-pointer flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-b from-[#251540] to-[#160B29] border border-purple-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(147,51,234,0.25)]">
                  <UploadCloud className="w-8 h-8 text-purple-300" />
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight">
                  {csvFile ? csvFile.name : 'Drag & drop your lead list (CSV)'}
                </h3>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm">
                  Upload cold prospect contacts. Dynamic custom variables will automatically parse into JSON.
                </p>
                <div className="mt-4 px-4 py-2 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-medium hover:bg-purple-500/20 transition-all">
                  Browse Computer
                </div>
              </label>
            </div>

            {/* Column Mapping Table */}
            <div className="bg-[#0F0A1C]/90 border border-[#271742] rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#21123B]">
                <div>
                  <h4 className="text-base font-semibold text-white">Map CSV Headers to Fields</h4>
                  <p className="text-xs text-zinc-400">Match the columns from your CSV with your database lead attributes.</p>
                </div>
                <div className="flex items-center space-x-2">
                  {isEmailMapped ? (
                    <span className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Email mapped successfully</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Email mapping required</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-zinc-400 border-b border-[#1F1238]">
                      <th className="pb-3 px-4">CSV Column Header</th>
                      <th className="pb-3 px-4">Preview Sample (Row 1)</th>
                      <th className="pb-3 px-4">Destination Attribute</th>
                      <th className="pb-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1033]">
                    {columnMappings.map((mapping, idx) => (
                      <tr key={idx} className="hover:bg-[#160E26]/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-medium text-purple-300">
                          {mapping.csvHeader}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300 text-xs font-mono truncate max-w-xs">
                          {mapping.sampleValue}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={mapping.mappedField}
                            onChange={(e) => handleMappingChange(idx, e.target.value)}
                            className="bg-[#19102B] border border-[#341F59] text-zinc-200 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-purple-500 focus:outline-none w-56"
                          >
                            {DB_FIELD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {mapping.mappedField === 'ignore' ? (
                            <span className="text-[11px] text-zinc-500">Ignored</span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[11px] text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                              <Check className="w-3 h-3 text-purple-400" />
                              <span>Ready</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sequence Builder with Spintax & Personalization */}
        {activeTab === 'sequences' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Steps List */}
            <div className="col-span-12 lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Sequence Steps</span>
                <button
                  onClick={addSequenceStep}
                  className="flex items-center space-x-1 text-xs text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-2.5 py-1.5 rounded-xl transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Step</span>
                </button>
              </div>

              {sequences.map((step, idx) => (
                <div
                  key={step.id}
                  onClick={() => setActiveSequenceIndex(idx)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    activeSequenceIndex === idx
                      ? 'bg-gradient-to-r from-[#20123D] to-[#170B2E] border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                      : 'bg-[#0E091B]/80 hover:bg-[#150D26] border-[#251540]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="h-6 w-6 rounded-lg bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-bold">
                        {step.stepNumber}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {step.stepNumber === 1 ? 'Initial Cold Email' : `Follow-up Step ${step.stepNumber}`}
                      </span>
                    </div>

                    {sequences.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSequenceStep(idx);
                        }}
                        className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 truncate font-mono">{step.subject || 'No subject line'}</p>

                  {step.stepNumber > 1 && (
                    <div className="mt-2.5 flex items-center space-x-2 text-[11px] text-fuchsia-300">
                      <Clock className="w-3 h-3" />
                      <span>Wait {step.delayDays} days after Step {step.stepNumber - 1}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right Editor Pane */}
            <div className="col-span-12 lg:col-span-8 bg-[#0F0A1C]/90 border border-[#271742] rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#21123B]">
                <div className="flex items-center space-x-3">
                  <h3 className="text-sm font-semibold text-white">
                    Editing Step {sequences[activeSequenceIndex].stepNumber}
                  </h3>
                  {sequences[activeSequenceIndex].stepNumber > 1 && (
                    <div className="flex items-center space-x-2 text-xs bg-[#19102B] px-3 py-1 rounded-xl border border-[#341F59]">
                      <span className="text-zinc-400">Delay:</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sequences[activeSequenceIndex].delayDays}
                        onChange={(e) => updateCurrentSequence('delayDays', parseInt(e.target.value) || 1)}
                        className="w-10 bg-transparent text-purple-300 font-mono focus:outline-none"
                      />
                      <span className="text-zinc-400">days</span>
                    </div>
                  )}
                </div>

                {sequences[activeSequenceIndex].stepNumber > 1 && (
                  <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sequences[activeSequenceIndex].threadReply}
                      onChange={(e) => updateCurrentSequence('threadReply', e.target.checked)}
                      className="rounded bg-[#19102B] border-purple-500/40 text-purple-600 focus:ring-0"
                    />
                    <CornerDownRight className="w-3.5 h-3.5 text-purple-400" />
                    <span>Send as reply in same thread</span>
                  </label>
                )}
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Subject Line</label>
                <input
                  type="text"
                  value={sequences[activeSequenceIndex].subject}
                  onChange={(e) => updateCurrentSequence('subject', e.target.value)}
                  placeholder="e.g. Quick question {{first_name}}"
                  className="w-full bg-[#160E26] border border-[#2F1B4E] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 font-mono"
                />
              </div>

              {/* Personalization & Spintax Pill Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                <span className="text-xs text-zinc-400 flex items-center space-x-1 mr-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Insert:</span>
                </span>
                {VARIABLE_TAGS.map((v) => (
                  <button
                    key={v.tag}
                    onClick={() => insertTextAtCursor(v.tag)}
                    className="text-xs font-mono bg-[#1B102E] hover:bg-purple-950/40 border border-[#37205C] hover:border-purple-500/50 text-purple-200 px-2.5 py-1 rounded-lg transition-all"
                  >
                    {v.tag}
                  </button>
                ))}

                <div className="h-4 w-[1px] bg-[#2A1847] mx-1" />

                {SPINTAX_TEMPLATES.map((spin, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => insertTextAtCursor(spin)}
                    className="text-xs font-mono bg-[#23123D] hover:bg-fuchsia-950/40 border border-[#482273] hover:border-fuchsia-500/50 text-fuchsia-200 px-2.5 py-1 rounded-lg transition-all"
                    title="Click to insert spintax variation"
                  >
                    {spin.length > 25 ? spin.substring(0, 22) + '...}' : spin}
                  </button>
                ))}
              </div>

              {/* Email Body Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">Email Body (Plain Text or HTML)</label>
                  <span className="text-[11px] text-zinc-500">Supports Spintax &amp; Liquid merge tags</span>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  rows={9}
                  value={sequences[activeSequenceIndex].body}
                  onChange={(e) => updateCurrentSequence('body', e.target.value)}
                  className="w-full bg-[#160E26] border border-[#2F1B4E] rounded-2xl p-4 text-sm text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Schedule Settings */}
        {activeTab === 'schedule' && (
          <div className="bg-[#0F0A1C]/90 border border-[#271742] rounded-3xl p-8 shadow-xl max-w-4xl mx-auto w-full space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white">Sending Schedule &amp; Pacing</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Define the timezone and allowable business hours for sending cold sequences.
              </p>
            </div>

            {/* Timezone Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300">Target Audience Timezone</label>
              <select
                value={schedule.timezone}
                onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                className="w-full bg-[#180F2B] border border-[#341F59] text-zinc-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="America/New_York">Eastern Time (US &amp; Canada) - New York [UTC-4]</option>
                <option value="America/Chicago">Central Time (US &amp; Canada) - Chicago [UTC-5]</option>
                <option value="America/Los_Angeles">Pacific Time (US &amp; Canada) - Los Angeles [UTC-7]</option>
                <option value="Europe/London">London (GMT / BST) [UTC+1]</option>
                <option value="Europe/Berlin">Central European Time - Berlin, Paris [UTC+2]</option>
                <option value="Asia/Dubai">Gulf Standard Time - Dubai [UTC+4]</option>
                <option value="Asia/Singapore">Singapore / Hong Kong [UTC+8]</option>
              </select>
            </div>

            {/* Sending Days (Mon-Sun pills) */}
            <div className="space-y-2.5">
              <label className="text-xs font-medium text-zinc-300">Active Sending Days</label>
              <div className="flex items-center gap-2">
                {[
                  { num: 1, label: 'Mon' },
                  { num: 2, label: 'Tue' },
                  { num: 3, label: 'Wed' },
                  { num: 4, label: 'Thu' },
                  { num: 5, label: 'Fri' },
                  { num: 6, label: 'Sat' },
                  { num: 7, label: 'Sun' },
                ].map((d) => {
                  const isSelected = schedule.days.includes(d.num);
                  return (
                    <button
                      key={d.num}
                      type="button"
                      onClick={() => toggleDay(d.num)}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-gradient-to-b from-purple-600 to-indigo-700 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                          : 'bg-[#150D24] text-zinc-400 hover:text-white border border-[#2D1B4D]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sending Window (Hours) */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Start Time</label>
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })}
                  className="w-full bg-[#180F2B] border border-[#341F59] text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">End Time</label>
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })}
                  className="w-full bg-[#180F2B] border border-[#341F59] text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
              </div>
            </div>

            {/* Daily Limits & Jitter Delay */}
            <div className="grid grid-cols-2 gap-6 pt-2 border-t border-[#21123B]">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Max New Leads Reached / Day</label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={schedule.dailyLimit}
                  onChange={(e) => setSchedule({ ...schedule, dailyLimit: parseInt(e.target.value) || 50 })}
                  className="w-full bg-[#180F2B] border border-[#341F59] text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Wait Between Sends (Jitter)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={60}
                    max={1200}
                    value={schedule.minIntervalSeconds}
                    onChange={(e) => setSchedule({ ...schedule, minIntervalSeconds: parseInt(e.target.value) || 180 })}
                    className="w-full bg-[#180F2B] border border-[#341F59] text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                  <span className="text-xs text-zinc-400 whitespace-nowrap">seconds (3-9 mins)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Deliverability Options & Tracking */}
        {activeTab === 'options' && (
          <div className="bg-[#0F0A1C]/90 border border-[#271742] rounded-3xl p-8 shadow-xl max-w-4xl mx-auto w-full space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white">Deliverability &amp; Tracking Options</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure pixel tracking, link redirection, and automated stop triggers.
              </p>
            </div>

            <div className="divide-y divide-[#21123B] space-y-4">
              {/* Open Tracking Toggle */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span>Track Email Opens</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
                      1x1 Pixel
                    </span>
                  </span>
                  <p className="text-xs text-zinc-400">
                    Injects a hidden tracking pixel. Disabling open tracking can increase inbox deliverability rates by up to 15%.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, trackOpens: !options.trackOpens })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    options.trackOpens ? 'bg-purple-600' : 'bg-[#25163D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      options.trackOpens ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Link / Click Tracking */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white">Track Link Clicks</span>
                  <p className="text-xs text-zinc-400">
                    Wraps URLs with your custom tracking domain to count click events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, trackClicks: !options.trackClicks })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    options.trackClicks ? 'bg-purple-600' : 'bg-[#25163D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      options.trackClicks ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Stop on Reply */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span>Stop Sequence on Lead Reply</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                      Recommended
                    </span>
                  </span>
                  <p className="text-xs text-zinc-400">
                    Halts all future automated drip follow-ups as soon as a lead sends a reply.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, stopOnReply: !options.stopOnReply })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    options.stopOnReply ? 'bg-purple-600' : 'bg-[#25163D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      options.stopOnReply ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Stop on Out-of-Office */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white">Stop on Auto-Reply / Out of Office</span>
                  <p className="text-xs text-zinc-400">
                    Pauses lead outreach if an auto-responder or vacation reply is detected.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, stopOnAutoReply: !options.stopOnAutoReply })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    options.stopOnAutoReply ? 'bg-purple-600' : 'bg-[#25163D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      options.stopOnAutoReply ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Plain Text Delivery */}
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-sm font-semibold text-white">Send as Plaintext Only</span>
                  <p className="text-xs text-zinc-400">
                    Strips HTML wrappers to mimic raw mail client composition and maximize spam filter evasion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, sendAsPlaintext: !options.sendAsPlaintext })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    options.sendAsPlaintext ? 'bg-purple-600' : 'bg-[#25163D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      options.sendAsPlaintext ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Custom Tracking Domain Input */}
            <div className="pt-4 border-t border-[#21123B] space-y-2">
              <label className="text-xs font-medium text-zinc-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Custom CNAME Tracking Domain</span>
              </label>
              <input
                type="text"
                value={options.trackingDomain}
                onChange={(e) => setOptions({ ...options, trackingDomain: e.target.value })}
                placeholder="e.g. track.yourdomain.com"
                className="w-full bg-[#180F2B] border border-[#341F59] text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              />
              <p className="text-[11px] text-zinc-500">
                Points your custom domain to our proxy so open/click tracking doesn&apos;t harm shared domain reputation.
              </p>
            </div>
          </div>
        )}

        {/* Bottom Pagination / Progression Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1C1133]">
          <button
            disabled={activeTab === 'leads'}
            onClick={() => {
              if (activeTab === 'sequences') setActiveTab('leads');
              if (activeTab === 'schedule') setActiveTab('sequences');
              if (activeTab === 'options') setActiveTab('schedule');
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-[#150D24] border border-[#2B1747] disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1 transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous Step</span>
          </button>

          <button
            onClick={() => {
              if (activeTab === 'leads') setActiveTab('sequences');
              else if (activeTab === 'sequences') setActiveTab('schedule');
              else if (activeTab === 'schedule') setActiveTab('options');
              else alert('Ready to launch campaign!');
            }}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 shadow-[0_0_20px_rgba(147,51,234,0.3)] flex items-center space-x-1.5 transition-all"
          >
            <span>{activeTab === 'options' ? 'Review & Launch' : 'Next Step'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </main>
    </div>
  );
}
