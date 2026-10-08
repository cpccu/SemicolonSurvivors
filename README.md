# CampusOS

A connected campus hub concept for City University, Bangladesh, built for the CPCCU web-app development hackathon.

## Current implementation status

This is a runnable full-stack foundation, **not a finished hackathon submission**. CampusOS is now login-first: only verified active accounts can open the campus interface or read campus APIs. Six migrations, including the privacy hardening migration, are applied to the configured hosted project. The signed-in hub covers all 11 planned modules with clearly labeled synthetic content alongside persistent workflows. SMTP rollout, authoritative data, full hosted scenario verification, and deployment remain pending.

What works locally:

- Desktop sidebar, mobile navigation, module browsing, and hash-based navigation.
- Full-page private account gateway; anonymous responses contain no campus shell or dashboard HTML/RSC.
- Richer Today hub with a named account/role panel, task-oriented quick actions, scoped enrollment/staff entry, a campus activity timeline, and scheduled-bus preview. The full 11-module map remains in the sidebar and Campus spaces; Today avoids repeating the directory.
- Guided enrollment import at `/auth/enrollment`: choose CSV or JSON, upload/paste a bounded source, review row-level conflicts, then confirm the persisted roster. Roster-only confirmation remains available while SMTP invitations are disabled.
- Visual module workspaces with original geometric map artwork, live-account/synthetic-data boundaries, task actions, and responsive section navigation instead of a text-only module stack.
- A full product-design system now spans the shell, dashboard, module workspaces, dialogs, forms, account gateway, MFA/enrollment surfaces, loading/empty/error/success states, and mobile navigation. The visual language uses deep ink, indigo, citrus, coral, and cool mist surfaces with bounded motion rather than a one-off dashboard theme.
- Search/filter over labeled demo records inside the authenticated workspace. Synthetic course materials are presented as downloadable PDF guides and still require an active account.
- Session-only bookmarks and fictional support drafts with honest unavailable states.
- Accessible native dialogs, keyboard search shortcut, scroll reveals, and reduced-motion support.
- Environment validation, maintained Supabase SSR helpers, scoped authorization primitives, safe error mappings, roster activation routes, TOTP security, and private QR ticket workflows.
- Persistent API routes for academic content, resources, helpdesk/services, directory, transport, lost-and-found, complaints, and administration. AI is server-side, source-grounded, bounded, and disabled by default.

Synthetic preview interactions do not issue real tickets, submit real claims, or modify university information. Only persisted records use the live workflows. Sample schedules, notices, organizers, and course examples are not official CU information. Never put real campus records into client fixture files or public assets.

### Campus privacy

- Signed-out visitors see branding and account access only; no campus browsing, search, directory, events, or resource previews.
- The server verifies identity and active profile before constructing the campus page. Client session changes remove the workspace while access is rechecked.
- Campus API reads require active membership, with role/scope/ownership checks retained for restricted records and writes.
- The privacy migration revokes former anonymous table/RPC grants and tightens RLS, including for records labeled `public`. That legacy label now means discovery among active accounts, not anonymous publication.
- Private Storage remains private. Resource signed URLs are issued only after active-account authorization and expire after 60 seconds; previously issued links remain valid until expiry.
- Health and account-entry routes stay available. Account approval, confirmation, reset, and MFA are not public campus-content access.

## Planned modules

1. Onboarding and directory
2. Personalized dashboard/feed
3. Clubs and events
4. Academic notices/class updates
5. Resource Hub
6. Transport information
7. Helpdesk/knowledge base
8. Lost and found
9. Private complaints/support tickets
10. Forms/services/deadlines
11. Scoped administration/moderation

## Stack

Next.js App Router, React, strict TypeScript, CSS design tokens, Lucide icons, self-hosted Public Sans, Zod, and Supabase client/SSR libraries. Vitest provides unit checks; Playwright exercises the rendered app on desktop and mobile. Versions are pinned in `package.json` and `package-lock.json`.

No external animation API is needed. CSS and IntersectionObserver provide purposeful motion while leaving native scrolling intact.

## Run locally

Prerequisites: a Node/npm version supported by `package.json`. The initial implementation was checked on Node 26.9.0 and npm 12.0.2.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Without configured backend access, the account gateway remains visible with honest unavailable controls; it does not expose an anonymous campus preview.

For configured integrations, create an ignored `.env.local` using the variable names from `.env.example`. Do not commit real values or paste them into chat. Current environment validation expects Supabase's publishable/secret key formats, not legacy JWT keys.

- `NEXT_PUBLIC_SUPABASE_URL`: project origin.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public publishable key, never an elevated key.
- `SUPABASE_SECRET_KEY`: server-only credential for guarded identity readiness, rate limiting, managed enrollment, and private storage adapters; never expose it to browser code.
- `CAMPUS_AI_ENABLED`: `false` by default; the server never calls Gemini unless this is `true`.
- `GEMINI_API_KEY` and `GEMINI_MODEL_ID`: server-only provider credentials and model selection.
- `CAMPUS_AI_PRIVACY_REVIEWED` and `CAMPUS_AI_QUOTA_VERIFIED`: required explicit local/deployment attestations.
- `CAMPUS_AI_HELPDESK_ENABLED` and `CAMPUS_AI_RESOURCE_SUMMARIES_ENABLED`: independently opt into source-grounded Helpdesk answers and reviewed text-resource summaries.

When enabled, AI accepts only consented non-personal questions or approved public/campus text excerpts. Private complaints, student records, roster data, and private resources are not sent to the provider. Setting environment variables alone does **not** implement enrollment, migrations, or RLS.

### Apply the reviewed database migrations

The repository contains ordered migrations in `supabase/migrations/`. Before applying them to the hosted project:

1. Open Supabase **Connect** and copy a direct or session-pooler PostgreSQL connection string into ignored `.env.local` as `SUPABASE_DB_URL`.
2. Keep the password inside the local file or password manager; never put it in chat or source.
3. Review the six migration files, then run once for a fresh project:

```bash
npm run db:migrate
```

The script refuses to replay when `public.profiles` already exists. It applies identity, events, content/resources, community workflows, private storage metadata, and login-first privacy in order. It does not bootstrap a privileged operator, import students, configure SMTP, or seed official data. The configured project already has institution metadata and an active scoped operator with verified TOTP. Do not rerun the bootstrap migration command there, or self-grant roles from the browser. For an existing installation, apply only a reviewed new migration after checking its current schema state.

If the project already contains tables or a failed partial migration, stop and inspect the hosted schema before retrying. Do not delete/reset a hosted project to make this script pass.

## Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E tests start the built production app on port 3100 and an isolated synthetic HTTPS Auth/REST transport on port 3201. Node, OpenSSL, and Chromium are required. Build first and keep both ports available. The fixture never uses developer credentials or contacts hosted Supabase; it verifies synthetic tokens server-side rather than adding an application auth bypass. Browser screenshots and failure traces are ignored under `test-results/`.

`npm run test:integration` runs real embedded PostgreSQL migration/RLS tests. It does not prove hosted Auth, Storage, SMTP, or quotas. Latest verification: lint, typecheck, build, 300 unit tests, 25 PostgreSQL integration tests, and 66 desktop/mobile browser tests passed. The redesign review also checks all module destinations at 360/768/1440px, reduced-motion/no-IntersectionObserver content availability, CSV import review/confirm/read-back, the grouped Explore campus spaces drawer with keyboard close/focus restoration and module navigation, and axe-core color contrast/named controls on account entry and signed-in Today. Live anonymous API and direct hosted Supabase denial checks also passed. No public demo credentials are provided.

### Enrollment import workflow

1. Sign in with an approved active account that has the institution-scoped `enrollment_admin` role.
2. Complete a recent authenticator verification so the session is AAL2; the page intentionally hides import controls until this is true.
3. Open `/auth/enrollment`, leave **CSV** selected for the downloadable template, or choose **JSON** for an existing `{ "rows": [...] }` payload.
4. Upload a local file or paste the source. CSV headers must be exactly `studentId,email,fullName,department,batch`; one import accepts 1–50 rows and is bounded to 32,768 UTF-8 bytes.
5. Select **Review source**. Fix row/field messages locally, then inspect server-returned identity conflicts and unchanged records.
6. Select **Confirm approved roster** only after reviewing the table. With SMTP disabled, leave invitations off: the roster can still be persisted and each row reports its account/invitation outcome.

The page does not send source data anywhere before review. Server-side institution scope, active-account status, AAL2, validation, staging expiry, conflict handling, and persistence remain authoritative. A `401` while loading recent imports or previewing means the session is not currently authorized (signed out, inactive, wrong scope, or not stepped up), not that the browser should retry blindly; sign in again or open account security.

## Student usability

The Today preview illustrates how a student can see a course room/time correction, inspect the next scheduled bus, discover an event, and find course material from one starting point. A fresher can browse the directory and orientation articles rather than discover campus channels alone. These are demonstrable browsing experiences; operational actions still require backend implementation.

## Security boundaries and remaining work

- Managed authentication helpers fail closed when configuration is absent/invalid.
- Scoped policies distinguish ownership, staff assignment, active status, and MFA assurance. Hosted migration and anonymous-denial verification are complete; scenario-level access, concurrency, recovery, and live Storage tests remain required.
- Security headers include frame restrictions, content-type protection, and a baseline CSP. Static hydration currently requires inline scripts/styles; this is not a nonce-based strict CSP.
- UI hiding is not the security boundary: signed-out campus rendering, app API access, and direct database reads are all restricted independently.
- Private uploads, activation, revocation, rate limits, transactional seat allocation/check-in, and audit persistence are implemented in code; hosted application, SMTP, and backup/recovery verification remain gates.
- AI is disabled and makes no external calls. Provider quota/privacy verification remains required.

## Free-service deployment prerequisites

- Supabase default SMTP is restricted to project-team addresses and is not suitable for student invitations. Configure a verified custom SMTP provider before live enrollment.
- Check Vercel Hobby eligibility, GitHub organization deployment restrictions, and account quotas before deployment. Free availability does not imply suitability for institutional production use.
- Verify Gemini model eligibility, current quota, and data-use terms; do not send sensitive student records by default.
- Reminders/background retries require a tested executor; a delivery table alone is insufficient.

Sources checked during setup: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Vercel Hobby](https://vercel.com/docs/plans/hobby). Terms may change.

## Submission

Target repository: https://github.com/cpccu/SemicolonSurvivors.git. No repository push or public deployment has been performed by this implementation session. The final submission still needs verified deployment/login, complete module flows, documentation, and an accessible presentation/demo video.
