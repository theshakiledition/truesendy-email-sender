import React from 'react';
import UnifiedInbox from '@/components/unibox/UnifiedInbox';
import UserNavbar from '@/components/layout/UserNavbar';

export const metadata = {
  title: 'Unified Inbox | Truesendy Cold Outreach',
  description: 'Manage, view, and respond to incoming lead replies across all active campaigns',
};

export default function UniboxPage() {
  return (
    <div className="min-h-screen bg-[#0d0714] text-slate-100 flex flex-col font-sans">
      <UserNavbar />
      <main className="flex-1">
        <UnifiedInbox />
      </main>
    </div>
  );
}
