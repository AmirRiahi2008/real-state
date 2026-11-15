import type { Metadata } from 'next';
import type { Locale } from '@/lib/api';
import TeamDashboard from '@/components/team/team-dashboard';

export const metadata: Metadata = {
  title: 'Your workspace — ORIVA',
  robots: { index: false, follow: false },
};
export default async function DashboardPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <TeamDashboard locale={locale} />;
}
