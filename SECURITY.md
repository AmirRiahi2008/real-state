# Security

This file describes the implemented security properties and deployment responsibilities of this backend. It is not a claim that the application is free of vulnerabilities or that an external penetration test has been performed.

## Reporting

Report a suspected vulnerability privately to the repository owner using GitHub's private vulnerability reporting facility when enabled. If it is unavailable, request a private reporting channel without publishing exploit steps, credentials or customer data in a public issue. Include the affected commit, prerequisites, minimal reproduction and observed impact using test accounts. Do not test systems you do not control.

## Properties maintained by the implementation

- All application routes require authentication unless explicitly marked public. Staff role checks and resource ownership checks are separate; agents cannot manage other agents' inventory or leads.
- Passwords use Argon2id. Public registration always creates a customer; administrative provisioning is a separate operator command with no default credentials.
- Access JWTs check algorithm, issuer, audience, token kind, expiry, session state and current user activity. Session/access changes take effect without waiting for JWT expiry.
- Opaque refresh and one-time tokens are stored as hashes. Refresh cookies are HttpOnly; cookie-authenticated refresh/logout require an exact allowed Origin and a matching CSRF header/cookie. Refresh rotates tokens; replay revokes the family. Password changes/resets and account access changes revoke sessions.
- Public account registration and password-reset requests use generic responses. Verification/reset links are single-use and expire. Email token plaintext temporarily exists in the database outbox until delivery/expiration/retry exhaustion; protect the database and backups accordingly.
- DTOs reject unknown fields and bound strings, numeric ranges, arrays and pagination. Database queries use parameterized Prisma operations; raw locking queries use bound tagged-template parameters.
- Public inventory/media predicates exclude hidden records and inactive dependencies. Explicit public projections exclude authentication fields, internal lead notes and internal file keys. Contact intake returns no lead lookup ID or PII.
- Redis rate limits operate across replicas; limiter errors fail closed. Helmet, restricted CORS, request size limits, safe error envelopes and minimal request logging are configured globally.
- Uploads accept bounded static raster formats, verify decoder results, limit pixels and re-encode as WebP. Client filenames never become storage paths. SVG/HTML uploads and remote-URL fetching are not supported.
- Administrative publication and access changes, authentication events and lead updates write audit records with limited metadata. Audit records are ordinary protected database rows; they are not an immutable external audit ledger.

## Production configuration

1. Terminate HTTPS at a trusted reverse proxy; set the exact `TRUST_PROXY_HOPS` topology. Never trust arbitrary forwarded client IPs.
2. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`, HTTPS `FRONTEND_URL` and exact HTTPS `CORS_ORIGINS`. Use same-site frontend/API origins with the implemented Lax cookie policy.
3. Generate a unique random `JWT_SECRET` of at least 64 characters. Store it, database/Redis credentials and SMTP credentials in the hosting platform's secret manager. Do not bake `.env` files into images. Rotating the JWT key invalidates existing access tokens.
4. Keep PostgreSQL and Redis on private networks. Use transport security where needed and separate runtime credentials from schema-migration credentials. Development Compose binds exposed ports to localhost and is not a public production infrastructure definition.
5. Configure authenticated SMTP with TLS or STARTTLS; production requires encrypted delivery. Email links use `FRONTEND_URL`; do not derive reset destinations from request headers.
6. Mount durable media storage with appropriate permissions and backups. Use shared storage for multiple API replicas. Grant the non-root runtime only the filesystem and database rights it needs.
7. Apply reviewed migrations through a deployment job, back up first when warranted, and verify restore procedures. Runtime startup intentionally does not migrate the schema.

The production validator rejects insecure cookie/HTTP-origin/public-Swagger settings and requires TLS SMTP or STARTTLS on port 587. It does not configure certificates, network policies, backup retention or a reverse proxy for you.

## Operational data handling

Leads contain names, contact details, messages and private staff notes. User records contain identity information. Limit database access and exports, define retention/deletion procedures appropriate to the deployed business, and keep backups encrypted and access-controlled. The API does not implement a customer-erasure workflow or scheduled retention policy; operators must establish these before collecting production data.

Sent/expired/exhausted account-email outbox rows have recipient/subject/body cleared. Other database rows, session history and audit metadata need an operator-defined retention policy. HTTP logs omit request bodies, authorization headers, cookies and query strings, but paths and identifiers can remain in logs. Configure reverse-proxy, SMTP and monitoring logs with the same care. Never put tokens or customer messages into audit metadata.

The local Mailpit inbox exposes account links to anyone who can access it. Its ports are bound to localhost by Compose; do not expose it publicly. Demo data is explicitly fictional, opt-in, disabled in production and has no published login password. Do not use demo fixtures as production inventory.

## Ongoing maintenance and verification

Run `npm run check` and `npm run test:e2e` when changing auth, publication predicates, ownership or migrations. E2E requires dedicated infrastructure and a PostgreSQL role with `CREATEDB`; it creates a temporary database and isolated Redis rate-limit namespace, without flushing a shared Redis database. CI uses read-only GitHub permissions and verified action commit pins; review dependency, image and action updates regularly.

Run dependency vulnerability checks in the release environment and investigate applicable findings. Keep the Node 24 runtime and base image patched, and pin a tested image digest for repeatable deployments. Application rate limiting is not a substitute for edge traffic controls or infrastructure capacity management. Staff-supplied permit/licence fields are stored display metadata, not an external verification result.

### Dependency audit at initial delivery

On 11 November 2026, `npm audit --omit=dev` reported no production dependency findings. The full audit reported six low-severity entries from the development Jest/ts-jest dependency chain, rooted in `deepmerge@4.3.1` and [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). The advisory describes prototype poisoning during object merging and lists no patched version. The API does not accept Jest configuration, and the runtime image excludes these development packages. Keep test configuration trusted and track the upstream fix; a forced downgrade to an older Jest major is not applied as a substitute for a compatible fix. Recheck the audit when updating the lockfile.
