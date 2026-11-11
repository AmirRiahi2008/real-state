import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="container page-shell section error-state">
      <p className="eyebrow">404 · ORIVA</p>
      <h1>A different direction.</h1>
      <p>This page couldn’t be found. A new perspective is just around the corner.</p>
      <Link href="/en" className="button button-primary">
        Back to the story ↗
      </Link>
    </section>
  );
}
