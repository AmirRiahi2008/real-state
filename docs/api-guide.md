# API guide

Base URL: `http://localhost:4000/api/v1`. Interactive development documentation is at `/api/docs`; JSON is at `/api/openapi.json` when `SWAGGER_ENABLED=true`. DTOs and the generated OpenAPI document are authoritative for full request schemas and enum values.

## Shared conventions

- JSON requests use `Content-Type: application/json`; uploads use multipart field `file`.
- Public detail routes use slugs. Mutations, ownership routes and relations use UUIDs.
- Inventory money and canonical area inputs use decimal strings, such as `"1750000.00"` and `"125.00"`. Money is AED and area is square metres. Calculator query parameters are bounded numeric inputs.
- EN/AR fields are returned together. Text fields contain plain text or Markdown source, not trusted HTML; render them with escaping and disable raw HTML in Markdown.
- Query booleans are `true` or `false`. UUID lists in listing queries are comma-separated.
- Paginated collections return `{ data, meta: { total, page, limit, totalPages } }`. The default page is 1, limit is 20, and maximum limit is 50. Some helper endpoints return a smaller `{ data }` response instead.
- Invalid/unknown fields are rejected. Do not submit client-controlled `role`, publication `status`, ownership fields or internal notes to a public endpoint.
- Error bodies contain `statusCode`, `message`, `requestId`, `path` and `timestamp`. Stale inventory versions return 409; refresh the managed record before retrying.

Common status codes are 400 validation, 401 missing/expired session, 403 insufficient permission/Origin/CSRF, 404 absent or inaccessible resource, 409 conflict, 413 oversized body, 429 request limit and 503 unavailable required infrastructure. Error responses never intentionally include a stack trace or database query.

## Authentication and frontend connection

Register at `POST /auth/register` with `email`, `password`, `firstName`, `lastName`. Passwords are 12–128 characters for customer registration and password changes. Registration always uses the `CUSTOMER` role. The 202 response does not reveal whether an account already exists. Verify the emailed token using `POST /auth/email/verify` with `{ "token": "..." }`.

Login requires an exact allowed `Origin`, even for curl or Swagger. The generated development configuration explicitly allows `http://localhost:3000` for Next.js and `http://localhost:4000` for local Swagger. If you keep an older `.env`, add the Swagger origin to `CORS_ORIGINS` before using its login form. Production must use your exact HTTPS application origins.

```bash
curl -i -c /tmp/estate-local-cookies.txt \
  -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-account@example.com","password":"your-own-password"}' \
  http://localhost:4000/api/v1/auth/login
```

The JSON body includes `accessToken`, `tokenType`, `expiresIn`, safe `user` fields and `csrfToken`. The refresh token is an HttpOnly cookie. Protected routes use `Authorization: Bearer <accessToken>`. Cookie jar files contain session credentials; keep them outside the repository and remove them after use.

A frontend can hold the access token and CSRF token in memory and send `credentials: 'include'` for login/refresh/logout. Refresh uses cookies, an allowed Origin and `X-CSRF-Token`. Each successful refresh rotates both the refresh cookie and the CSRF token; replace the in-memory tokens from its response. Coordinate one refresh request at a time across concurrent client calls because reuse of a rotated token revokes the session family.

```ts
const api = 'http://localhost:4000/api/v1';
const loginResponse = await fetch(`${api}/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!loginResponse.ok) throw new Error('Sign-in failed');
let session = await loginResponse.json();

const refreshResponse = await fetch(`${api}/auth/refresh`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-CSRF-Token': session.csrfToken },
});
if (!refreshResponse.ok) throw new Error('Sign in again');
session = await refreshResponse.json();

const profile = await fetch(`${api}/auth/me`, {
  headers: { Authorization: `Bearer ${session.accessToken}` },
});
```

Browsers add `Origin` automatically; JavaScript must not try to set that forbidden request header. Production cookies use `Secure`, `SameSite=Lax`, `Path=/` and the `__Host-` prefix. Host the frontend/API on the same site or proxy API calls through the frontend origin. Deploying them on unrelated sites requires a deliberate cookie/CSRF design change; CORS alone does not make Lax cookies cross-site.

| Route                               | Access / behavior                                               |
| ----------------------------------- | --------------------------------------------------------------- |
| `POST /auth/register`               | Public; 202 generic email follow-up                             |
| `POST /auth/login`                  | Public, allowed Origin; access token and cookies                |
| `POST /auth/refresh`                | Allowed Origin, refresh cookie, CSRF; rotates session           |
| `POST /auth/logout`                 | Allowed Origin, refresh cookie, CSRF; 204                       |
| `POST /auth/logout-all`             | Bearer; revokes all own sessions; 204                           |
| `GET /auth/me`                      | Bearer; own safe account fields                                 |
| `POST /auth/change-password`        | Bearer; `currentPassword`, `newPassword`; revokes sessions; 204 |
| `POST /auth/password-reset/request` | Public; `email`; 202 generic response                           |
| `POST /auth/password-reset/confirm` | Public; `token`, `newPassword`; revokes sessions                |
| `POST /auth/email/verify`           | Public; single-use `token`                                      |
| `POST /auth/email/resend`           | Bearer; 202 generic response                                    |

Verification links last 24 hours and reset links 15 minutes. Staff mutations require a verified account. Access tokens last up to 15 minutes by default, but the server also checks the referenced session and current user access on every protected request. Logout, password/access changes and refresh replay can invalidate an unexpired access token.

## Public discovery

| Routes                                                        | Purpose                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /listings`, `/listings/:slug`, `/listings/:slug/related` | Published property discovery/detail/related inventory       |
| `GET /projects`, `/projects/:slug`                            | Published off-plan projects and payment/floor-plan metadata |
| `GET /areas`, `/areas/:slug`                                  | Active area directory/details                               |
| `GET /developers`, `/developers/:slug`                        | Active developers                                           |
| `GET /agents`, `/agents/:slug`                                | Public profiles of active verified staff                    |
| `GET /amenities`                                              | Amenity directory                                           |
| `GET /catalog/autocomplete?q=...`                             | Area suggestions                                            |
| `GET /content`, `/content/:slug`                              | Published guides/articles                                   |
| `GET /media/:id/file`                                         | Image only when referenced by a public record               |

```bash
curl --get http://localhost:4000/api/v1/listings \
  --data-urlencode 'purpose=SALE' \
  --data-urlencode 'emirate=DUBAI' \
  --data-urlencode 'propertyType=APARTMENT' \
  --data-urlencode 'minPrice=1000000.00' \
  --data-urlencode 'maxPrice=3000000.00' \
  --data-urlencode 'bedrooms=2' \
  --data-urlencode 'sort=price_asc' \
  --data-urlencode 'limit=20'
```

Listing filters are `q`, `purpose`, `propertyType`, `emirate`, `completion`, `availability`, `furnishing`, `areaIds`, `amenityIds`, `projectId`, `agentId`, `minPrice`, `maxPrice`, `minAreaSqm`, `maxAreaSqm`, `bedrooms`, `minBathrooms`, `isExclusive`, `priceOnRequest`, `reducedPrice`, `vacantBy`, `south`, `north`, `west`, `east`, `sort`, `page`, `limit`. `agentId` here is the **public agent-profile ID** returned by `/agents`, not a private user ID. A map filter requires all four bounds and increasing south/north, west/east. Sorting supports `recent`, `price_asc`, `price_desc`, `area_asc`, `area_desc`. Price-on-request cannot be combined with a price range.

Project filters are `q`, `areaId`, `developerId`, `emirate`, `propertyType`, `minPrice`, `maxPrice`, `bedrooms`, `priceOnRequest`, `handoverFrom`, `handoverTo`, `sort`, `page`, `limit`; project sort supports `recent`, `price_asc`, `price_desc`, `handover`.

## Customer workspace

All `/me/*` routes require a bearer token and always derive ownership from it.

| Route                                 | Behavior                                                     |
| ------------------------------------- | ------------------------------------------------------------ |
| `GET /me/favorites`                   | Paginated favorites still publicly visible                   |
| `PUT /me/favorites/:listingId`        | Idempotent add; 204; maximum 100                             |
| `DELETE /me/favorites/:listingId`     | Idempotent remove; 204                                       |
| `DELETE /me/favorites`                | Clear all, including unavailable inventory; 204              |
| `GET /me/saved-searches`              | Paginated own saved searches                                 |
| `POST /me/saved-searches`             | Create `{ name, filters }`; maximum 20                       |
| `GET /me/saved-searches/:id`          | Own saved search                                             |
| `PATCH /me/saved-searches/:id`        | Change name and/or filters                                   |
| `DELETE /me/saved-searches/:id`       | Delete own search; 204                                       |
| `GET /me/saved-searches/:id/listings` | Execute saved public query with optional page/limit override |

```json
{
  "name": "Dubai two-bedroom apartments",
  "filters": {
    "purpose": "SALE",
    "propertyType": "APARTMENT",
    "emirate": "DUBAI",
    "bedrooms": 2,
    "maxPrice": "3000000.00",
    "sort": "price_asc"
  }
}
```

Saved filters use the exact public listing-query allowlist. Arbitrary ORM predicates, publication status and account IDs are rejected. Results always apply current publication/access predicates; saving a search does not grant access to hidden records and does not schedule email alerts.

## Lead intake and staff follow-up

`POST /leads` is public and returns **202** with only a generic message. Required contact fields are `name`, `email`, E.164 `phone`, `message` and `consent: true`. Types are:

| Type                    | Target                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `ENQUIRY`               | Exactly one public `listingId`                                                         |
| `VIEWING`               | Exactly one public `listingId` and future `preferredAt` with timezone, within 365 days |
| `PROJECT`               | Exactly one public `projectId`                                                         |
| `VALUATION`, `MORTGAGE` | No listing/project target                                                              |

```json
{
  "type": "ENQUIRY",
  "listingId": "de000000-0000-4000-8000-000000000009",
  "name": "Example buyer",
  "email": "buyer@example.com",
  "phone": "+971501234567",
  "message": "Please share more details about this property.",
  "consent": true
}
```

The shown UUID belongs to the optional fictional demo fixture. Real submissions must use a currently public listing ID. The endpoint never accepts `status`, `assignedToId` or `internalNotes`; listing leads are assigned server-side to the listing's agent.

AGENT/ADMIN may `GET /leads`, `GET /leads/:id` and `PATCH /leads/:id`. Agents see/change only assigned leads; administrators can assign or unassign with `assignedToId` (null clears it). Assignees must be active verified staff user IDs. Patch fields are `status`, `internalNotes`, `assignedToId`. Status progresses `NEW → CONTACTED → QUALIFIED → CLOSED`; early closure is also supported. Only an administrator can reopen `CLOSED → NEW`. Contact details and internal notes are available solely in authorized staff responses.

## Inventory, content and account administration

| Resource                                  | Management API                                                                                                                                      | Access                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Listings                                  | `GET /listings/manage/mine`, `GET /listings/manage/:id`, `POST /listings/manage`, `PATCH /listings/manage/:id`                                      | AGENT own; ADMIN all                                        |
| Listing transitions                       | `POST /listings/manage/:id/{submit,publish,reject,archive}`                                                                                         | Submit/archive: owner staff; publish/reject: ADMIN          |
| Projects                                  | `GET /projects/manage`, `GET /projects/manage/:id`, `POST /projects/manage`, `PATCH /projects/manage/:id` and transition suffixes above             | ADMIN                                                       |
| Areas/developers/amenities/agent profiles | `POST /{areas,developers,amenities,agents}/manage`, `PATCH /{resource}/manage/:id`                                                                  | ADMIN                                                       |
| Content                                   | `GET /content/manage`, `GET /content/manage/:id`, `POST /content/manage`, `PATCH /content/manage/:id`, `POST /content/manage/:id/{publish,archive}` | ADMIN                                                       |
| Users                                     | `GET /users`, `PATCH /users/:id` with role/isActive                                                                                                 | ADMIN                                                       |
| Own profile                               | `PATCH /users/me/profile` with firstName/lastName                                                                                                   | Any authenticated user                                      |
| Media                                     | `POST /media`, `GET /media/manage/mine`, `GET /media/manage/:id/file`, `DELETE /media/:id`                                                          | Staff; preview restricted by owner/admin/assigned reference |

Register the staff customer account, verify its email, promote it through the ADMIN user API, then create its public agent profile through `/agents/manage`. A staff user ID is different from its public agent-profile ID. Public signup cannot grant staff access.

Create inventory as a draft, attach at least one uploaded image, submit for review, and publish as an administrator. Project review also requires a handover date. Send `{ "version": <latestVersion> }` for listing/project transitions. Patches likewise require the latest version. Edits to published listings/projects remove them from public results pending review; archive is terminal in the current API. For example:

```bash
curl -X POST http://localhost:4000/api/v1/listings/manage/LISTING_UUID/submit \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"version":1}'
```

Submit/publish returns an incremented version; use that value for the next action. A listing associated with a project must share its active area and reference a published project. Rent listings need `rentalPeriod`; studio listings have zero separate bedrooms. Payment-plan milestone percentages, when supplied, must sum to exactly 100.

Upload one static JPEG/PNG/WebP file as multipart field `file`, at most 5 MiB by default. The server checks the decoded image, limits pixels and returns re-encoded WebP metadata/URL. A newly uploaded image's public file URL returns 404 until attached to a public record. Staff can use the bearer-authenticated `/media/manage/:id/file` route for authorized draft previews. Use its `id` in a `media` attachment `{ mediaId, position, altEn, altAr }`; `position` and media IDs must be unique. Detach images before deleting them.

## Calculators

```bash
curl 'http://localhost:4000/api/v1/calculators/mortgage?priceAed=2000000&downPaymentPercent=25&annualInterestRate=4&years=25'
curl 'http://localhost:4000/api/v1/calculators/rental-yield?priceAed=2000000&annualRentAed=150000&annualCostsAed=20000'
```

Mortgage uses fixed-rate monthly amortization, supports zero interest and returns deposit, principal, monthly repayment and total interest as decimal AED strings. It accepts prices up to AED 1 billion, 0–100% down payment, 0–30% annual interest and 1–30 years. Rental yield returns gross/net percentages and annual net income, including negative results. Responses explicitly identify excluded costs and estimation assumptions; neither endpoint provides lending approval, eligibility rules or guaranteed returns.

## Limits and client handling

Most GET requests allow 120 requests/minute per route/IP and writes 30/minute. Sensitive actions have tighter limits: lead intake and registration 5/minute, login 10/minute, reset request 3/minute, upload 10/minute. Read `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `Retry-After`; wait before retrying 429 responses. JSON bodies are limited to 1 MiB independently of DTO field bounds. Use the generated OpenAPI contract when implementing typed Next.js API calls.

## Structured rich content

Article/news bodies accept nullable `bodyRichEn` / `bodyRichAr`. Listing and project descriptions accept nullable `descriptionRichEn` / `descriptionRichAr`. The document follows the shared contract in `packages/rich-content/index.d.ts`; inline images persist a UUID `mediaId`, never an external source URL. Raw HTML nodes, unsafe links, unrecognized attributes and oversized/deep trees are rejected. Existing plain text fields remain available, and the server derives them from a supplied rich document.

Omitting a locale preserves its content. Sending plain text for a locale without its rich companion clears that locale's prior formatting. Explicit `null` clears formatting while retaining text unless replacement text is provided. Version and publication transitions are unchanged. Public collection responses omit rich document trees; detail endpoints include them. Inline media references participate in ownership, publication eligibility and deletion checks through database foreign keys.
