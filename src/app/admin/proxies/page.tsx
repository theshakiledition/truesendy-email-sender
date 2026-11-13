import ProxyManager from '@/components/admin/ProxyManager';

export const metadata = {
  title: 'Proxy Pool Manager | Admin Outreach Engine',
  description: 'Manage and bulk import Webshare outbound proxies for sender inboxes',
};

export default function AdminProxiesPage() {
  return <ProxyManager />;
}
