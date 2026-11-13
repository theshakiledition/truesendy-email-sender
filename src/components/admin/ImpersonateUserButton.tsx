'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, Loader2 } from 'lucide-react';

interface ImpersonateUserButtonProps {
  userId: string;
  userEmail: string;
  isSuperAdmin: boolean;
}

export default function ImpersonateUserButton({
  userId,
  userEmail,
  isSuperAdmin,
}: ImpersonateUserButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (isSuperAdmin) {
    return null; // Cannot impersonate fellow superadmins
  }

  const handleImpersonate = async () => {
    if (!confirm(`Are you sure you want to log into ${userEmail}'s account as an impersonator?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start impersonation session.');
      }

      // Refresh session and navigate to user campaign dashboard
      router.push('/campaigns/new');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error initiating impersonation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-700/50 hover:border-fuchsia-500 rounded-lg text-fuchsia-300 hover:text-white text-[11px] font-medium transition shadow-sm disabled:opacity-50"
      title={`Access ${userEmail}'s account`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-400" />
      ) : (
        <UserCheck className="w-3.5 h-3.5 text-fuchsia-400" />
      )}
      <span>Access Account</span>
    </button>
  );
}
