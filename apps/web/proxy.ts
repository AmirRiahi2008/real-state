import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/') return NextResponse.redirect(new URL('/en', request.url));
  const headers = new Headers(request.headers);
  headers.set('x-oriva-locale', request.nextUrl.pathname.split('/')[1] === 'ar' ? 'ar' : 'en');
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|images|fonts|icons|offline|sw.js|manifest.webmanifest|favicon.ico|icon.svg).*)',
  ],
};
