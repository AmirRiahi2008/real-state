import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
loadEnvironment({ path: resolve(root, 'apps/api/.env'), quiet: true });
// Render generates 256 random bits as base64 (~44 characters). Derive a stable,
// domain-separated 128-character signing key without reducing that entropy.
if (!process.env.JWT_SECRET && process.env.JWT_SECRET_SEED) {
  if (process.env.JWT_SECRET_SEED.length < 43) {
    console.error('JWT_SECRET_SEED must contain at least 43 characters from a secure generator.');
    process.exit(1);
  }
  process.env.JWT_SECRET = createHash('sha512')
    .update('oriva:access-token-signing:v1\0', 'utf8')
    .update(process.env.JWT_SECRET_SEED, 'utf8')
    .digest('hex');
}
const args = new Set(process.argv.slice(2));
const development = args.has('--dev');
const apiOnly = args.has('--api-only');
const checkOnly = args.has('--check');
const restoreOnly = args.has('--restore-media-only');
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor !== 24 || nodeMinor < 11) {
  console.error('Use Node.js 24.11 or newer within the Node 24 release line.');
  process.exit(1);
}

function port(value, fallback, name) {
  const candidate = value ?? String(fallback);
  if (!/^\d+$/.test(candidate) || Number(candidate) < 1024 || Number(candidate) > 65535) {
    console.error(`${name} must be an integer between 1024 and 65535.`);
    process.exit(1);
  }
  return Number(candidate);
}
const publicPort = args.has('--local') ? 3000 : port(process.env.PORT, 5000, 'PORT');
const apiPort = apiOnly ? publicPort : port(process.env.API_PORT, 4000, 'API_PORT');
if (!apiOnly && apiPort === publicPort) {
  console.error('PORT and API_PORT must be different when running both applications.');
  process.exit(1);
}
for (const key of [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'CORS_ORIGINS',
  'SMTP_HOST',
  'SMTP_FROM',
]) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Configure the Replit database and application Secrets first.`);
    process.exit(1);
  }
}
if (checkOnly) {
  console.log(
    `Replit launcher prerequisites checked: ${development ? 'development' : 'production'}, ${apiOnly ? 'API only' : 'website and API'}, public port ${publicPort}. The API validates its complete environment at startup.`,
  );
  process.exit(0);
}

const mode = development ? 'development' : 'production';
const backendUrl = `http://127.0.0.1:${apiPort}`;
const apiDirectory = resolve(root, 'apps/api');

async function restoreDemoMedia() {
  const assetDirectory = resolve(apiDirectory, 'demo-assets');
  const uploadDirectory = resolve(apiDirectory, process.env.UPLOAD_DIR || 'uploads');
  const expected = new Map([
    ['original-demo.webp', 'de000000-0000-4000-8000-000000000007.webp'],
    ...Array.from({ length: 8 }, (_, index) => [
      `property-${String(index + 1).padStart(2, '0')}.webp`,
      `de100000-0000-4000-8000-${(601 + index).toString(16).padStart(12, '0')}.webp`,
    ]),
  ]);
  const manifest = JSON.parse(await readFile(resolve(assetDirectory, 'storage-map.json'), 'utf8'));
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== expected.size
  )
    throw new Error('The immutable demo image manifest is incomplete.');
  const seen = new Set();
  for (const item of manifest.files) {
    if (expected.get(item.source) !== item.storageKey || seen.has(item.source))
      throw new Error('The immutable demo image manifest contains an unexpected entry.');
    seen.add(item.source);
  }
  await mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
  let restored = 0;
  for (const item of manifest.files) {
    const destination = resolve(uploadDirectory, item.storageKey);
    try {
      // Only known, packaged illustration files are restored. Existing files are untouched.
      await copyFile(resolve(assetDirectory, item.source), destination, constants.COPYFILE_EXCL);
      await chmod(destination, 0o600);
      restored++;
    } catch (error) {
      if (error.code !== 'EEXIST')
        throw new Error('An immutable demo image could not be restored.');
    }
  }
  console.log(
    `Demo image cache checked: ${restored} restored, ${expected.size - restored} existing files preserved.`,
  );
}
const children = new Set();
const useProcessGroups = process.platform !== 'win32';
let stopping = false;
function terminate(child, signal) {
  try {
    if (useProcessGroups && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH')
      console.error('A child process could not receive its shutdown signal.');
  }
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) terminate(child, 'SIGTERM');
  const force = setTimeout(() => {
    for (const child of children) terminate(child, 'SIGKILL');
  }, 8000);
  force.unref();
}
function start(name, executable, commandArgs, cwd, env) {
  const child = spawn(executable, commandArgs, {
    cwd,
    env,
    stdio: 'inherit',
    detached: useProcessGroups,
  });
  children.add(child);
  child.once('error', () => {
    console.error(`${name} could not start. Check the installed runtime and build output.`);
    stop(1);
  });
  child.once('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} stopped; shutting down the application.`);
      stop(code || 1);
    }
  });
  return child;
}
process.once('SIGINT', () => stop(130));
process.once('SIGTERM', () => stop(0));

try {
  await restoreDemoMedia();
  if (restoreOnly) process.exit(0);
  const apiEntry = resolve(apiDirectory, 'dist/main.js');
  if (!development && !existsSync(apiEntry))
    throw new Error('Build the API before starting production.');
  start(
    'Nest API',
    development ? 'npm' : process.execPath,
    development ? ['run', 'start:dev', '-w', '@real-estate/api'] : [apiEntry],
    development ? root : apiDirectory,
    {
      ...process.env,
      NODE_ENV: mode,
      PORT: String(apiPort),
      HOST: apiOnly ? '0.0.0.0' : '127.0.0.1',
    },
  );

  if (!apiOnly) {
    const deadline = Date.now() + 45000;
    let ready = false;
    while (!ready && !stopping && Date.now() < deadline) {
      try {
        ready = (
          await fetch(`${backendUrl}/api/v1/health/ready`, { signal: AbortSignal.timeout(2000) })
        ).ok;
      } catch {
        /* Wait for the real PostgreSQL/Redis-backed API. */
      }
      if (!ready) await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    }
    if (!ready)
      throw new Error('The API did not become ready. Check database, Redis and configuration.');
    start(
      'Next website',
      process.execPath,
      [
        resolve(root, 'node_modules/next/dist/bin/next'),
        development ? 'dev' : 'start',
        '--hostname',
        '0.0.0.0',
        '--port',
        String(publicPort),
      ],
      resolve(root, 'apps/web'),
      {
        ...process.env,
        NODE_ENV: mode,
        BACKEND_INTERNAL_URL: backendUrl,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Application startup failed.');
  stop(1);
}
