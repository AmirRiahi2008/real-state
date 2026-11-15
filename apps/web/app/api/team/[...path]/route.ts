import { createPrivateGateway } from '@/lib/private-api-gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handle = createPrivateGateway('team');
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
