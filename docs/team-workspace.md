# Team workspace

The bilingual public directory is `/en/qa` or `/ar/qa`. Team members sign in at `/{locale}/dashboard/login`; their workspace is `/{locale}/dashboard`.

Each account has the dedicated `TEAM_MEMBER` authorization role. It can change only its own display name, EN/AR introduction, EN/AR public title and profile photo, change its password, and read/reply to conversations addressed to its own profile. Public display titles never change authorization. Inventory, catalog, publication, user administration and other content mutations remain unavailable.

Profile changes are stored in PostgreSQL and fetched without a shared cache. A profile-save notification refreshes open QA tabs; visibility changes and periodic refresh cover other browsers. Uploads accept one static JPEG, PNG or WebP file up to 4 MB, decode under a pixel limit, strip metadata and save a WebP owned by the account. Another account's media cannot be attached.

Guest conversations require explicit consent. The API creates a random 256-bit receipt, stores only its hash and expiry, and binds it to one conversation. The website keeps the receipt in an HttpOnly, SameSite cookie scoped to that conversation. The guest can return in the same browser; knowing an email or conversation ID is insufficient to read it. Replies appear through bounded polling, paused when the page is hidden. Older messages use a cursor verified inside the authorized conversation.

The website gateway keeps staff access, refresh and CSRF tokens out of JavaScript and local storage. Mutations require an exact approved Origin, bodies have size limits, and only explicit team routes are proxied. Staff refresh is serialized across browser tabs using Web Locks. Password changes revoke existing sessions and require a fresh sign-in.

## Local account provisioning

There are no default passwords in the repository or public frontend. To create local team accounts, put a private JSON file outside tracked source, with mode `0600`. Its shape is:

```json
{
  "members": [
    {
      "email": "person@example.test",
      "password": "YOUR_PRIVATE_INITIAL_PASSWORD",
      "firstName": "Example",
      "lastName": "Person",
      "slug": "example-person",
      "displayName": "Example Person",
      "titleEn": "Manager",
      "titleAr": "مدير",
      "bioEn": "A short introduction.",
      "bioAr": "تعريف قصير.",
      "photoPath": "/absolute/path/to/local-photo.jpg"
    }
  ]
}
```

Run after setup, migration and Prisma generation:

```bash
ALLOW_LOCAL_TEAM_PROVISION=true TEAM_PROVISION_FILE=/absolute/path/to/private.json npm run team:provision -w @real-estate/api
```

The CLI refuses production, hashes passwords with Argon2, normalizes photos and creates limited accounts. Repeating it preserves existing matching accounts and their passwords; conflicting emails abort without changing those accounts. The actual local provisioning file and supplied photos belong in ignored private storage, not in source control.

## Verification

API unit and isolated PostgreSQL/Redis integration tests cover role boundaries, photo ownership, guest receipts, expiration, pagination, member isolation and password revocation. Browser gateway-policy tests need no personal accounts.

Public QA layout and navigation checks use a deterministic directory fixture with shipped demo images, so they also run on fresh CI databases without personal accounts or photos. These checks do not mock authenticated messages or profile mutations.

Local browser workflow tests can use a private provisioning fixture:

```bash
TEAM_E2E_PROVISION_FILE=/absolute/path/to/private.json PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:web
```

The personal-account browser cases skip when the fixture is absent. They restore the tested profile, avatar and password. No credentials or personal photos are embedded in those tests.
