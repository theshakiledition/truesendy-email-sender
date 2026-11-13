'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Server,
  Layers,
  Settings,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Users & Workspaces', href: '/admin/users', icon: Users },
  { name: 'Proxy Fleet', href: '/admin/proxies', icon: Server, badge: 'Live' },
  { name: 'System Queues', href: '/admin/queues', icon: Layers, badge: 'BullMQ' },
  { name: 'Global Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-[#11071c] border-r border-purple-900/30 flex flex-col justify-between select-none relative z-20">
      {/* Top Branding Section */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-purple-900/30 gap-3 bg-[#160a24]/60">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-800 to-fuchsia-600 text-white shadow-md shadow-fuchsia-950/50">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              TrueSendy
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800/50 font-mono font-semibold">
                Superadmin
              </span>
            </div>
            <p className="text-[10px] text-purple-300/50 tracking-wider uppercase font-medium">
              Control Center
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400/50">
            System Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-900/80 to-fuchsia-950/60 text-white border-l-2 border-fuchsia-500 shadow-lg shadow-purple-950/40'
                    : 'text-purple-300/70 hover:text-white hover:bg-[#1a0e28] hover:translate-x-0.5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive
                        ? 'text-fuchsia-400'
                        : 'text-purple-400/60 group-hover:text-purple-300'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        isActive
                          ? 'bg-fuchsia-900/80 text-fuchsia-200 border border-fuchsia-700/50'
                          : 'bg-purple-950/60 text-purple-400 border border-purple-800/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-fuchsia-400" />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer / User Profile & Logout */}
      <div className="p-4 border-t border-purple-900/30 bg-[#140822]/60 space-y-3">
        {/* Superadmin Status Card */}
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="text-[11px] font-semibold text-purple-200">System Healthy</div>
          </div>
          <span className="text-[10px] font-mono text-purple-400/70">BullMQ v6</span>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
              SA
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">Superadmin</div>
              <div className="text-[10px] text-purple-300/50 truncate font-mono">
                superadmin@truesendy.com
              </div>
            </div>
          </div>

          <button
            title="Sign out"
            className="p-1.5 text-purple-400 hover:text-white rounded-lg hover:bg-purple-950/60 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
