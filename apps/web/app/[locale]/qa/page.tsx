import type { Metadata } from 'next';
import type { Locale } from '@/lib/api';
import QaDirectory from '@/components/team/qa-directory';

export const metadata: Metadata = { title: 'QA — Meet the ORIVA team' };
export default async function QaPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <QaDirectory locale={locale} />;
}
