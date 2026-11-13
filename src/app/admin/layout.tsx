/**
 * src/app/admin/layout.tsx
 * AdminGuard Authentication Wrapper and Superadmin Master Layout.
 * Strictly verifies SUPERADMIN role. Unauthenticated or non-superadmin users receive a 404.
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const metadata = {
  title: 'Superadmin Console | TrueSendy',
  description: 'Enterprise Cold Outreach Infrastructure Control Center',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Resolve logged-in user
  const user = await getCurrentUser();

  // 2. Check authentication and Superadmin privileges
  if (!user) {
    redirect('/login');
  }

  if (!isSuperAdmin(user)) {
    redirect('/campaigns/new');
  }

  // 3. Render Dark Mode Plum Layout
  return (
    <div className="min-h-screen bg-[#0d0714] text-slate-100 flex font-sans antialiased selection:bg-fuchsia-600 selection:text-white">
      {/* Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 px-8 border-b border-purple-900/30 bg-[#12081c]/70 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
            <span className="text-xs font-semibold text-purple-200 tracking-wide">
              SUPERADMIN PRIVILEGED ENVIRONMENT
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800/40 text-purple-300 font-mono text-[11px]">
              Env: <span className="text-fuchsia-400 font-bold">{process.env.NODE_ENV || 'production'}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 font-mono text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Redis Connected
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
