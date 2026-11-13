'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';

interface ImpersonationBannerProps {
  initialUser?: {
    email?: string;
    impersonatorId?: string | null;
  } | null;
}

export default function ImpersonationBanner({ initialUser }: ImpersonationBannerProps) {
  const { user: contextUser, refreshSession } = useSession();
  const [fallbackUser, setFallbackUser] = useState(initialUser || null);
  const [isReverting, setIsReverting] = useState(false);
  const router = useRouter();

  // If outside SessionProvider, self-fetch session
  useEffect(() => {
    if (!contextUser && !initialUser) {
      fetch('/api/auth/session')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user?.impersonatorId) {
            setFallbackUser(data.user);
          }
        })
        .catch(() => {});
    }
  }, [contextUser, initialUser]);

  const activeUser = contextUser || fallbackUser;

  // Only render if active session contains an impersonatorId
  if (!activeUser || !activeUser.impersonatorId) {
    return null;
  }

  const handleReturnToAdmin = async () => {
    setIsReverting(true);

    try {
      const res = await fetch('/api/admin/impersonate/revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await refreshSession?.();
        // Redirect back to Superadmin dashboard
        window.location.href = '/admin';
      } else {
        alert(data.error || 'Failed to revert session.');
        setIsReverting(false);
      }
    } catch (err: any) {
      alert(`Network error while reverting session: ${err.message}`);
      setIsReverting(false);
    }
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 w-full bg-[#1c0e04]/95 border-b border-amber-500/30 text-amber-100 px-4 py-2.5 backdrop-blur-md shadow-2xl shadow-black/60 transition-all font-sans antialiased"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Warning Notification Copy */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 shadow-inner">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
          </div>

          <div className="truncate">
            <span className="font-semibold text-amber-200">
              You are currently impersonating{' '}
              <span className="font-bold underline decoration-amber-400/60 underline-offset-2 text-white">
                {activeUser.email}
              </span>
              .
            </span>{' '}
            <span className="text-amber-300/70 hidden md:inline">
              Actions you take will be logged.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReturnToAdmin}
            disabled={isReverting}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#1c0e04] shadow-md shadow-amber-950/40 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReverting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Returning to Admin...</span>
              </>
            ) : (
              <>
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Return to Admin</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
