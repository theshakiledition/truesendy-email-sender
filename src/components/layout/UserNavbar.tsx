'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Rocket,
  Inbox,
  MailCheck,
  Plus,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useSession } from '@/context/SessionContext';

export default function UserNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  };

  const navLinks = [
    { name: 'Campaigns', href: '/campaigns', icon: Rocket },
    { name: 'Unified Inbox', href: '/unibox', icon: Inbox },
    { name: 'Connected Inboxes', href: '/inboxes', icon: MailCheck },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#12081c]/90 backdrop-blur-xl border-b border-purple-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-8">
          <Link href="/campaigns" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-purple-800 flex items-center justify-center text-white shadow-md shadow-purple-950/60 border border-purple-400/30 group-hover:scale-105 transition">
              <Rocket className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                TrueSendy
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-purple-950 text-purple-300 border border-purple-800/40 rounded">
                  Outreach
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/campaigns'
                  ? pathname === '/campaigns' || pathname.startsWith('/campaigns/new')
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-purple-950/80 text-fuchsia-300 border border-purple-800/50 shadow-sm'
                      : 'text-purple-300/70 hover:text-white hover:bg-purple-950/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-fuchsia-400' : 'text-purple-400/60'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions & User Info */}
        <div className="flex items-center gap-3">
          {/* Quick Create Campaign Button */}
          <Link
            href="/campaigns/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white rounded-xl text-xs font-medium shadow-md shadow-purple-950/50 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </Link>

          {/* Return to Admin Link (If Superadmin or Impersonating) */}
          {session?.user?.role === 'SUPERADMIN' && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-800/50 rounded-xl text-[11px] font-medium text-purple-300 hover:text-white transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Admin Panel</span>
            </Link>
          )}

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-purple-900/40">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-white leading-none">
                {session?.user?.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-[10px] text-purple-400/60 font-mono mt-0.5 truncate max-w-[120px]">
                {session?.user?.email || 'Logged in'}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-purple-400 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/40 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
