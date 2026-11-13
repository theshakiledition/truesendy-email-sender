import React from 'react';
import ImpersonationBanner from '@/components/common/ImpersonationBanner';
import { SessionProvider } from '@/context/SessionContext';
import '@/app/globals.css';

export const metadata = {
  title: 'TrueSendy | Cold Email Outreach Engine',
  description: 'Enterprise Cold Outreach Platform and Deliverability Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0d0714] text-slate-100 antialiased font-sans selection:bg-fuchsia-600 selection:text-white">
        <SessionProvider>
          {/* Global Sticky Impersonation Banner */}
          <ImpersonationBanner />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
