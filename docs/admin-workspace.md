# Administration workspace

Sign in at `/en/admin/login` or `/ar/admin/login`. The workspace is `/{locale}/admin`. The dedicated `ADMIN` authorization role and a verified, active account are checked by the API, including reads. Ordinary team members, agents and customers cannot enter the administration gateway. Public display titles do not grant access.

The sidebar provides:

- Overview: actual database totals, UTC daily enquiry/conversation counts, publication statuses, sale/rent distribution, recent enquiries and audit activity. Select 7, 30 or 90 days for the daily series; portfolio totals remain all-time. There are no invented visitor, revenue or conversion figures.
- Properties, projects and articles: bilingual creation and editing, relationships, images, accessibility text and publication workflows. Updates use the current record version. Saved edits return published records to a draft; submit/publish them when ready. Archive removes them from public browsing while preserving history.
- Areas, developers, amenities and agent profiles: management including inactive/private records. Related selectors show unavailable records without allowing new invalid assignments.
- Website content: English/Arabic copy for metadata, navigation, home sections, all twelve construction chapters, contact, QA, footer and FAQs. Changes are plain text and use a shared version; concurrent edits return a conflict rather than overwriting someone else's work. Public tabs refresh after a save or on focus. New articles appear at `/{locale}/insights` and on the home page after publication.
- Media: normalized image upload, selection, ordering and deletion of unused assets. Linked media cannot be deleted. Admins can reuse the library; ordinary staff ownership rules remain in force.
- Team and QA: create limited team accounts or administrators and manage portraits, public titles, introductions and visibility. Administrators with team profiles retain their public QA identity and personal inbox.
- Users: create accounts, set authorization roles/active access, and set a new password. Changes revoke existing sessions. The last active administrator cannot be removed or demoted.
- Enquiries and conversations: assign and track customer enquiries, maintain internal notes, inspect the team's QA conversations and reply. Personal team dashboards remain scoped to their own conversations.
- Activity log and account: review recorded changes and update the signed-in administrator's password.

## Rich writing studio

News/articles and property/project descriptions use the bilingual writing studio. It supports bold, italic, underline, strike, headings, lists, quotes, highlighting, alignment, links, code blocks and dividers, undo/redo, and focus mode. Each language keeps its own content. Preview uses the same renderer as the public page.

Tables support a header row, row/column insertion and deletion, merged/split cells and column resizing, with a maximum 20 by 20 grid. Inline images can be uploaded, pasted, dropped or selected from the library. Provide alternative text or explicitly mark an image decorative; captions, width and alignment are editable. Images follow the same 5 MB upload rules as the media library.

Save a draft, then use the existing publication workflow. Inline images remain private until their record becomes publicly eligible. Archiving/unpublishing a record removes public access to its inline-only images. Referenced images cannot be deleted, including references in drafts or the other language. Plain-text records and API clients remain supported; a plain-text-only update explicitly removes the corresponding stored formatting.

Rich content is a bounded structured document, not trusted HTML. The shared `@oriva/rich-content` package defines the allowed nodes, formatting, links and media identifiers. The API independently validates it and derives searchable plain text, while public pages render React elements with safe URLs. Headings/titles/excerpts and short website copy remain plain text. News is available as a content category and at `/{locale}/insights?type=NEWS`.

## Local account promotion

The normal admin creation command deliberately refuses to overwrite an existing account. For an explicitly authorized existing local account, store a private JSON file with `{ "email": "person@example.test", "password": "YOUR_PRIVATE_INITIAL_PASSWORD" }`, mode `0600`, outside tracked source, then run:

```bash
ALLOW_LOCAL_ADMIN_PROMOTION=true ADMIN_PROMOTION_FILE=/absolute/path/to/private.json npm run admin:promote-local -w @real-estate/api
```

This command refuses production and nonlocal database hosts, preserves the existing team profile and photo, hashes the supplied password with Argon2 and revokes previous sessions and one-time tokens. It does not print credentials. Its local initial-password exception does not change the public registration, reset or change-password policy. New passwords chosen from the website require at least 12 characters.

## Gateway and verification

Admin tokens stay in HttpOnly, SameSite cookies scoped to `/api/admin`; team and guest cookies have separate scopes. Mutations check the exact approved Origin, request sizes are bounded, and only explicit resource routes are forwarded. The admin role is rechecked before every administrative data request, even when the underlying resource also supports agents. Refresh rotation is serialized across browser tabs. A temporary membership lookup failure preserves the newly rotated session cookie.

Backend unit and isolated PostgreSQL/Redis HTTP integration tests cover verified-role boundaries, real aggregates, CMS conflicts, user/password revocation, media policies and retained QA identities. Focused Next gateway tests cover cookie isolation, role withdrawal, origins, route/body limits and refresh errors. Personal-account browser tests use a private fixture via `ADMIN_E2E_PROVISION_FILE` and are skipped when it is absent. No real passwords or personal photos are embedded in source.

The local application uses the existing README setup. If port 4000 is occupied, use:

```bash
npm run infra:up
API_PORT=4010 npm run dev
```

Stop an existing local web/API process before starting another one on the same ports. Infrastructure volumes preserve local data. No deployment is required.
