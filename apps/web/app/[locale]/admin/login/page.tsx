import type { Metadata } from 'next';
import type { Locale } from '@/lib/api';
import AdminLogin from '@/components/admin/admin-login';

export const metadata: Metadata = {
  title: 'Administrator sign in — ORIVA',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <AdminLogin locale={locale} />;
}
