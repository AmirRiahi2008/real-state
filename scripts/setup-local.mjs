import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const destination = new URL('../apps/api/.env', import.meta.url);
if (existsSync(destination)) {
  console.log('apps/api/.env already exists; preserved.');
  process.exit(0);
}
const dbPassword = randomBytes(24).toString('hex');
const redisPassword = randomBytes(24).toString('hex');
const source = readFileSync(new URL('../apps/api/.env.example', import.meta.url), 'utf8')
  .replaceAll(
    'replace-with-at-least-64-random-characters-generated-by-setup-local',
    randomBytes(64).toString('hex'),
  )
  .replace(
    'POSTGRES_PASSWORD=replace-with-a-random-local-password',
    `POSTGRES_PASSWORD=${dbPassword}`,
  )
  .replace(
    'postgresql://estate:replace-with-a-random-local-password',
    `postgresql://estate:${dbPassword}`,
  )
  .replace('REDIS_PASSWORD=replace-with-a-random-local-password', `REDIS_PASSWORD=${redisPassword}`)
  .replace('redis://:replace-with-a-random-local-password', `redis://:${redisPassword}`);
writeFileSync(destination, source, { mode: 0o600, flag: 'wx' });
console.log('Created apps/api/.env with random local secrets. No credentials were printed.');
