import { expect, test } from '@playwright/test';
import { teamRoute, teamOrigins } from '../lib/team-gateway-policy';

const id = '516e8b2d-c14e-4d7c-af12-d29528060ad3';
test('team gateway exposes only the intended member and conversation operations', () => {
  expect(teamRoute('GET', 'members')).toBe('public');
  expect(teamRoute('POST', 'conversations')).toBe('public');
  expect(teamRoute('GET', `conversations/${id}`)).toBe('guest');
  expect(teamRoute('POST', `conversations/${id}/messages`)).toBe('guest');
  expect(teamRoute('GET', `inbox/${id}`)).toBe('staff');
  expect(teamRoute('POST', `inbox/${id}/replies`)).toBe('staff');
  expect(teamRoute('PATCH', 'me')).toBe('staff');
  for (const path of [
    'auth/register',
    'auth/logout-all',
    'users',
    'users/me',
    'listings/manage',
    '../auth/login',
    'conversations/not-a-uuid',
    `inbox/${id}/messages`,
  ])
    expect(teamRoute('POST', path)).toBeNull();
  expect(teamRoute('GET', `inbox/${id}/replies`)).toBeNull();
  expect(teamRoute('PATCH', `members/${id}`)).toBeNull();
});
test('team origin policy uses configured application origins and exact local fallbacks', () => {
  const local = teamOrigins({});
  expect([...local].sort()).toEqual(['http://127.0.0.1:3000', 'http://localhost:3000']);
  const deployed = teamOrigins({
    NEXT_PUBLIC_SITE_URL: 'https://oriva.example',
    VERCEL_URL: 'oriva-preview.example',
  });
  expect(deployed.has('https://oriva.example')).toBe(true);
  expect(deployed.has('https://oriva-preview.example')).toBe(true);
  expect(deployed.has('https://oriva.example.evil.test')).toBe(false);
  expect(deployed.has('http://localhost:3000')).toBe(false);
});
