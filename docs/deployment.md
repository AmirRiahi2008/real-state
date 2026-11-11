# Website and API deployment

The public website and the NestJS API are separate applications in this repository. The website has no administrator dashboard. Browser discovery, photographs, calculators and enquiry submissions use the website's narrow `/api/backend/v1/...` gateway. Its server-side `BACKEND_INTERNAL_URL` must point to the running Nest API origin, without an `/api/v1` suffix. Never put database credentials into a `NEXT_PUBLIC_*` variable.

## Replit workspace

The committed `.replit` configuration selects Node 24, maps the website's internal port 5000 to public port 80, and runs `scripts/start-replit.mjs --dev`. The supervisor keeps Nest on private loopback port 4000, waits for its PostgreSQL/Redis readiness, then starts Next on `0.0.0.0:5000`. It shuts down both applications if either fails. `API_PORT` can change the internal API port; it must differ from `PORT`.

Import the GitHub repository into the Replit App and ask Replit Agent to attach its managed PostgreSQL database while retaining the existing Prisma schema and migrations. Replit documents managed SQL integration and separate development/production databases; a database connection in a workspace is not proof that the published application has the same database. See [Replit Database](https://docs.replit.com/features/data-and-storage/sql-database) and [development and production databases](https://docs.replit.com/features/data-and-storage/development-and-production).

Preserve the platform-provided `DATABASE_URL` for the managed database; on current Replit infrastructure it is injected automatically rather than entered as a custom Secret. Use Replit Secrets for `REDIS_URL`, a random `JWT_SECRET` of at least 64 characters, frontend origin settings and SMTP credentials from `apps/api/.env.example`. Add a custom `DATABASE_URL` only when deliberately selecting an external database. Do not run `setup:local` to replace the platform connection with a Docker-local one. `replit.nix` provides PostgreSQL/Redis workspace utilities and OpenSSL; it does not start a database or Redis daemon. Node 24.11+ is required, and the launcher refuses other Node release lines.

After the managed development database and Redis are reachable, run the existing install, generate, migration and opt-in seed commands:

```sh
npm ci
npm run db:generate
npm run db:deploy
SEED_DEMO=true npm run db:seed
node scripts/start-replit.mjs --dev
```

The sample data is fictional and contains local stock photographs. Seeding is create-only and explicitly disabled when `NODE_ENV=production`. Seed a dedicated demonstration database before publishing it; never seed a database that contains real customer inventory. The launcher does not apply migrations, seed database rows or create cloud resources automatically. It restores only the nine packaged immutable demonstration image files into the configured upload cache, using their exact seeded storage keys and exclusive copy operations. Existing files are preserved. The thirteen demonstration listings share these illustrations; restoring them never creates or changes a database record or exposes an image whose database publication checks fail.

For workspace development, a Redis process can bind only to loopback and use the existing Redis password settings. A process-local Redis is not an acceptable replacement for managed shared Redis in a deployment that can run multiple instances. Do not replace the application's Redis limiter with an in-memory limiter.

## Published Replit application

The build command in `.replit` installs locked dependencies, generates Prisma and builds both applications. Its run command starts their compiled production outputs. Production validation requires HTTPS origins, secure cookies, disabled Swagger and encrypted SMTP. Apply reviewed migrations once as a deployment operation against the production database, rather than on every process start.

If Replit will host only the API while Vercel hosts the website, set the Replit deployment run command to `node scripts/start-replit.mjs --api-only`. Nest then binds `0.0.0.0` on the public `PORT`; the Vercel website can set `BACKEND_INTERNAL_URL` to that published Replit origin. Use the verified URL returned by publishing, rather than constructing a hostname. This mode serves the actual `/api/v1` Nest routes and keeps the frontend's proxy contract unchanged.

Autoscale can add replicas and scale to zero. Use managed PostgreSQL and shared Redis. The existing email outbox scheduler needs an always-on worker or a scheduled/durable execution mechanism when using scale-to-zero hosting; do not promise email delivery merely because an HTTP request was accepted. A Reserved VM provides an always-on process but is a billed deployment choice, not a free database substitute. See [deployment types](https://docs.replit.com/features/publishing/deployment-types).

Published filesystem writes must not be treated as durable storage. Replit explicitly advises using database/storage products instead of relying on a published app's filesystem. The current `LocalImageStorage` works for local development and immutable demo images restored from the packaged assets on every launch. This cache restoration is safe across restarts and new replicas, but provides no persistence for real uploads. Real uploads need an implementation backed by durable object storage such as Replit App Storage, with the existing ownership/publication checks retained. The database and media objects must both be restored when moving inventory. See [publishing](https://docs.replit.com/learn/projects-and-artifacts/replit-deployments) and [App Storage](https://docs.replit.com/features/data-and-storage/object-storage).

## Vercel website

Use the confirmed Vercel team and link this GitHub repository. The frontend root is `apps/web`, the framework is Next.js, and the runtime is Node 24. The website needs the private server environment variable `BACKEND_INTERNAL_URL`, pointing to a reachable deployed Nest API. It cannot reach `127.0.0.1` on the developer's computer. A deployment that renders empty/error states because its API is absent is not a fully connected deployment.

Vercel Services can alternatively deploy Next and Nest together with a private service binding. This is a beta feature, and still requires external persistent PostgreSQL, shared Redis, durable image storage and appropriate outbox execution. Do not expose database credentials or private binding variables to browser JavaScript. See [Vercel Services](https://vercel.com/docs/services).

The website gateway deliberately excludes administrator routes and does not forward browser authentication credentials. Its current backend IP limits see the gateway as a client. Before increasing production traffic, introduce a verified client-identity mechanism between the trusted gateway and API; do not blindly accept arbitrary forwarded-IP headers from the public internet.

## Render demonstration API

The repository's `render.yaml` creates only the `oriva-demo-api` free Node web service in Frankfurt. It references the already-created `oriva-demo-db` PostgreSQL and `oriva-demo-redis` Key Value instances in the confirmed workspace; it does not declare, replace or adopt those datastores. Blueprint references supply their internal connection strings without committing credentials. Render permits references to existing workspace resources outside a Blueprint. All three resources must remain in the same workspace and region. See the [Blueprint specification](https://render.com/docs/blueprint-spec) and [private networking](https://render.com/docs/private-network).

The build installs only the API workspace, generates Prisma, compiles Nest, applies reviewed migrations and explicitly seeds this dedicated fictional demonstration database. Only that seed command receives `NODE_ENV=development SEED_DEMO=true`; the running API remains in production mode. This build-time seed is specific to this demonstration service and must be removed before repointing it at a real business database. The start command restores the immutable illustration cache and serves the real API on Render's injected public `PORT` with host `0.0.0.0`.

Render generates `JWT_SECRET_SEED` as a random base64-encoded 256-bit secret. The launcher derives the API's signing key with domain-separated SHA-512 and passes the resulting 128-character hexadecimal `JWT_SECRET` only to its server process. The derivation is deterministic across restarts and preserves the generated seed's entropy. An explicitly configured `JWT_SECRET` takes precedence. Do not commit or log either value. After Vercel returns the actual public domain, keep `FRONTEND_URL` and `CORS_ORIGINS` synchronized with that exact HTTPS origin. Configure the Vercel website's private `BACKEND_INTERNAL_URL` with the Render API URL returned by the platform. The optional gateway HMAC secret must be set privately on both server deployments; it is not a browser environment variable.

This is a free demonstration deployment with concrete limits: its web service can sleep after 15 minutes without inbound traffic and a cold start can take about a minute; local filesystem changes disappear on restart; free PostgreSQL expires 30 days after creation and has no managed backups; free Key Value does not persist limiter keys across a restart. The currently created demo database expires on 11 December 2026. Keep the loading/error states visible during cold starts, and preserve PostgreSQL data externally or select an approved persistent plan before the demo expiry. See [Render Free limits](https://render.com/docs/free).

Public enquiry forms write to PostgreSQL and do not require email delivery. Account email delivery is intentionally not configured for this public-website demonstration; the SMTP settings are validation-compatible placeholders. Render Free blocks outbound SMTP ports 25, 465 and 587, so real verification/reset email needs an HTTPS mail-provider integration or an appropriate hosting change before enabling account flows. Do not describe an accepted enquiry or queued email as a delivered message.

The API Dockerfile also installs only the API workspace while retaining both workspace manifests for lockfile validation. Its non-root runtime includes the immutable demo assets and launcher, but excludes the Next.js application and development tools.

## Verification

1. Readiness must report success against real PostgreSQL and Redis.
2. Verify discovery, filtering, property/project details and photographs at the published website URL.
3. Submit a labelled test enquiry and verify its row in the intended database, without exposing contact details in public responses.
4. Test both languages, RTL, light/dark themes, scroll progress, reduced-motion behavior and mobile navigation.
5. Record the actual deployment URL, source commit and final ready status. Do not report a deployment as connected until the API/data path has been exercised.
