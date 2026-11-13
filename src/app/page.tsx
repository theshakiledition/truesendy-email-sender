import { redirect } from 'next/navigation';

export default function RootPage() {
  // Automatically redirect root visitors to the admin control panel
  redirect('/admin');
}
