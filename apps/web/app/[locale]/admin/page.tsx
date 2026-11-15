import type { Metadata } from 'next';
import type { Locale } from '@/lib/api';
import AdminWorkspace from '@/components/admin/admin-workspace';

export const metadata: Metadata = {
  title: 'Administration — ORIVA',
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <AdminWorkspace locale={locale} />;
}
