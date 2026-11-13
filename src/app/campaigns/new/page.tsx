import React from 'react';
import CampaignWizard from '@/components/campaign/CampaignWizard';
import UserNavbar from '@/components/layout/UserNavbar';

export const metadata = {
  title: 'New Campaign | Truesendy Outreach',
  description: 'Create and launch automated cold email outreach campaigns',
};

export default function NewCampaignPage() {
  return (
    <div className="min-h-screen bg-[#0d0714] text-slate-100 flex flex-col font-sans">
      <UserNavbar />
      <main className="flex-1">
        <CampaignWizard />
      </main>
    </div>
  );
}
