'use client';
import { usePathname } from 'next/navigation';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ar = usePathname().startsWith('/ar');
  return (
    <section className="container page-shell section error-state">
      <p className="eyebrow">ORIVA</p>
      <h1>{ar ? 'لنحاول مرة أخرى.' : 'Let’s try that again.'}</h1>
      <p>
        {ar
          ? 'تعذّر تحميل هذه الصفحة حالياً. الرجاء إعادة المحاولة بعد قليل.'
          : 'This page is taking a moment. Please try again shortly.'}
      </p>
      <button className="button button-primary" onClick={reset}>
        {ar ? 'إعادة المحاولة' : 'Try again'}
      </button>
    </section>
  );
}
