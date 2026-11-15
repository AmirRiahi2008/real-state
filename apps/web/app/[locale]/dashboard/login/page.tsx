import type { Metadata } from 'next';
import type { Locale } from '@/lib/api';
import TeamLogin from '@/components/team/team-login';

export const metadata: Metadata = {
  title: 'Team sign in — ORIVA',
  robots: { index: false, follow: false },
};
export default async function TeamLoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <TeamLogin locale={locale} />;
}
