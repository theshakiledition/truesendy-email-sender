import React from 'react';
import { Users, Building, ShieldCheck, Mail, Sparkles } from 'lucide-react';
import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

export const metadata = {
  title: 'Users & Workspaces | Superadmin Console',
  description: 'Manage registered users, workspaces, and team memberships',
};

export default async function AdminUsersPage() {
  let users: any[] = [];
  try {
    const prisma = getPrisma();
    users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  } catch {}

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-950/80 border border-purple-800/40 text-fuchsia-400 rounded-xl">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Users & Multi-Tenant Workspaces
            </h1>
          </div>
          <p className="text-xs text-purple-300/60 mt-1">
            Global account inventory, subscription tiers, and organization memberships.
          </p>
        </div>
      </div>

      <div className="bg-[#180c25]/80 border border-purple-900/40 rounded-2xl shadow-xl shadow-purple-950/40 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-purple-200">
            <thead className="bg-[#14081f] text-[11px] font-semibold uppercase text-purple-300/70 border-y border-purple-900/30 tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3.5">User</th>
                <th scope="col" className="px-6 py-3.5">Role</th>
                <th scope="col" className="px-6 py-3.5">Subscription</th>
                <th scope="col" className="px-6 py-3.5">Workspaces</th>
                <th scope="col" className="px-6 py-3.5 text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-purple-300/50">
                    No users registered yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-purple-950/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{u.firstName || ''} {u.lastName || ''}</div>
                      <div className="text-[11px] font-mono text-purple-400/70">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${u.systemRole === 'SUPERADMIN' ? 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700/50' : 'bg-purple-950 text-purple-300 border border-purple-800/40'}`}>
                        {u.systemRole || 'USER'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-emerald-400 font-semibold">{u.subscriptionTier || 'FREE'}</span>
                    </td>
                    <td className="px-6 py-4 text-purple-300/80">
                      {u.memberships?.length || 0} organizations
                    </td>
                    <td className="px-6 py-4 text-right text-purple-400/50 font-mono">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
