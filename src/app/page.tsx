import { redirect } from 'next/navigation';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (isSuperAdmin(user)) {
    redirect('/admin');
  }

  redirect('/campaigns/new');
}
