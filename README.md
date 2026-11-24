# Orthodox Services NZ

A website with the service schedules of the parishes of the Greek Orthodox Church in New Zealand (and Oceania). One central place to see the schedule of a single parish, of a named group of parishes, or of all parishes. English and Greek, mobile-friendly, hosted on Firebase.

**Status:** scaffold. The public pages (Services, Parishes, About) read from Firestore, and the admin area has Google and email sign-in and a placeholder dashboard. The Firebase project exists and the rules and indexes are deployed; the site is not on Hosting yet. See [Implementation plan](#implementation-plan) and `HANDOVER.md`.

Repo: https://github.com/myinsaneai/orthodox-services-nz. Organised like the author's other projects: the folder layout follows the Russian parish site (`axces2000/russian-church`), and the tests + `HANDOVER.md` working style follows `myinsaneai/fishing-league`.

## Contents
1. [Goals](#goals)
2. [Users and permissions](#users-and-permissions)
3. [Requirements](#requirements)
4. [Screens and design](#screens-and-design)
5. [Architecture](#architecture)
6. [Data model](#data-model)
7. [Implementation plan](#implementation-plan)
8. [Getting started](#getting-started)
9. [Firebase setup](#firebase-setup)
10. [Secrets and configuration](#secrets-and-configuration)
11. [Open decisions](#open-decisions)

## Goals
- Let a parishioner see what is on, and where, in two taps: all parishes, their group, or their own parish.
- Give each parish's own admins a place to keep their schedule up to date without being able to touch another parish.
- One central repository instead of many separate parish pages, with one consistent design.
- Public, no sign-in to read. No personal data is collected from visitors.

## Users and permissions

| Role | Can do |
|---|---|
| **Visitor** | Read the schedule, the parish directory and the About page. No account needed. |
| **User** | Anyone who signs in. Will save favourite parishes and apply to become a coordinator (not built yet). |
| **Coordinator** | As a user, plus create, edit and delete services **for the parishes listed on their profile** (`parishIds`). |
| **Admin** | As a coordinator for **all** parishes, plus give the roles user / coordinator / admin (My page → Users) to people who are currently users or coordinators. |
| **SuperAdmin** | As an admin, plus give any role (including SuperAdmin) to anyone, delete user profiles, and manage parishes, groups and site settings. |

Nobody can change or delete their own role. The table lives in `src/lib/roles.ts` and, for the server, in `firestore.rules`.

This extends the Russian parish site's single `admins/{uid}` + `sections` pattern: the delegated scope is now a list of **parishes** instead of a list of sections. Sign-in is Google or email + password (Firebase Auth). New email + password people register themselves on a short screen reached from the login form (confirm password, enter name); there is no separate sign-up page in the menu; a Google sign-in can create an Auth user for any Google account, but that person simply becomes a **user** and appears on My page → Users, where an admin can give them a role. The header has a Log in / Log out button next to the menu; every signed-in person also gets a **My page** menu entry with a second line of sections: Profile (name and photo, photo shrunk to 1024 px) for everyone, Parishes (add a parish, bilingual) and Users for admins and superadmins, more later.

## Requirements

### Schedule views
- Three scopes on one page: all parishes, a named group of parishes (e.g. "Wellington group"), one parish. Chosen by filter chips and a parish drop-down; the choice lives in the address, so a view can be shared: `/services`, `/services?group=<slug>`, `/services?parish=<slug>`.
- Shows upcoming services from today (New Zealand date) onward, ordered by date then time. Each entry: parish, title, date and time, optional notes.
- A parish can belong to several groups. A group, or a parish, that does not exist (or is hidden) shows "no services", never everything.
- Services of a hidden parish never show, in any view.

### Languages
- English and Greek, switched with `EN | ΕΛ` in the header. The first visit follows the browser language; the choice is remembered.
- Fixed interface text is in `src/lib/i18n.ts`. Content carries both languages (`nameEn`/`nameEl`, `titleEn`/`titleEl`, `notesEn`/`notesEl`); a missing Greek title or note falls back to the English one.

### Header and navigation
- The two seals flank the site title (Ecumenical Patriarchate on the left, Holy Metropolis of New Zealand on the right; the Metropolis seal now also covers Fiji, Tonga and Samoa). Shown at 100 px, 56 px on phones.
- Navigation is exactly **Services**, **Parishes**, **About**, plus the language switch.
- **Small screens (under 900 px):** header, menu and headings centred, content in a 700 px column.
- **Large screens (900 px and up):** the header is left-aligned as one group (left seal, title and menu, second seal right after the title), page headings and content start at the left page edge, and the content uses the full browser width. Services and parishes are card grids that add columns as the window widens (1 column on a phone, 2 at about 1100 px, 4 at 1600 px, 7 at 2560 px). Running text (About) stays at a readable line length.

### Branding
- One unified design for every parish, with a small per-parish accent: a coloured bar on each service card and a dot in the directory (`accentColor`).

### Times
- Dates and times are **New Zealand wall-clock** values stored as text (`"2026-12-06"`, `"09:00"`) and shown exactly as written; "today" is computed on a New Zealand clock. Nothing converts between time zones, so a service never shifts with daylight saving or with the visitor's device.

### Admin (planned)
- Parishes, groups, services (single and recurring, with feast-day overrides), users. A coordinator sees and edits only their own parishes.

## Screens and design

Design phase is finished: four directions were mocked up and **Option A, "Cathedral Classic"** was chosen (options B, C and D were not used). The seal sizes, palette and fonts below came out of that review.

| Token | Value | Use |
|---|---|---|
| Maroon | `#7A1F0A` (darker `#5E1707`) | Header |
| Cream | `#F3E8D9` | Hero band |
| Gold | `#C9A66C` | Hero heading, accents |
| Title gold | `#E7D3A6` | Site title on maroon |
| Nav gold | `#D8B98A` | Menu |
| Page / text | `#FAF6F0` / `#2A1C14` | Body |

Fonts: Cormorant Garamond (headings), Nunito Sans (body and menu), loaded from Google Fonts. Tokens are in `src/themes/tokens.ts` and as CSS variables in `src/index.css`.

Screens: **Services** (hero band, filter chips, grid of service cards), **Parishes** (grid of parish cards, each linking to that parish's schedule), **About** (placeholder), **Admin** (sign-in, dashboard placeholder).

The Option A prototype is on a private Claude page that only the author can open: https://claude.ai/artifact/EjUVe3aM9kHMUW8WnZevQK. The code is now the design reference.

## Architecture
- React 19 + TypeScript + Vite 8, React Router 7, Firebase web SDK 13 (Firestore, Auth, Hosting; Storage rules exist but nothing uploads yet). Plain CSS variables and inline styles, no UI library.
- **Public / admin split.** `src/lib/firebase.ts` has only the app and Firestore. Auth and Storage live in `src/lib/firebaseAdmin.ts`, which is imported only from `src/admin/**` and `contexts/AuthContext.tsx`. The whole admin area is one lazy chunk (`React.lazy` in `App.tsx`), so a visitor never downloads `firebase/auth`. A test checks that public pages do not start the auth listener.
- Pure logic (NZ date, time formatting, scope resolution, hidden-parish filter) is in `src/lib/schedule.ts` so it can be tested with fixed timestamps.
- No Cloud Functions yet. If some are added later, the region in the code and the Firestore location must agree.

```
src/
  admin/        LoginPage, ProfilePage, UsersPage, AdminApp (lazy entry, routes)
  components/   SiteLayout (header + nav), LangToggle, AuthGuard
  contexts/     AuthContext (profile, role, parish scope), roles.ts (who may give which role), LangContext (EN / ΕΛ)
  hooks/        (empty)
  lib/          firebase, firebaseAdmin, firestore (types + helpers), schedule, i18n
  pages/        SchedulePage, ParishesPage, AboutPage
  themes/       tokens.ts
  index.css     CSS variables, responsive layout classes (.site-header, .hero, .page, .cards-grid)
  assets/seals/ the two seal images
tests/          Vitest tests (see Testing)
```

Routes: `/` (goes to `/services`), `/services`, `/parishes`, `/about`, `/admin`, `/admin/login`. Unknown addresses go to `/services`.

## Data model

Firestore collections (all ids are the document ids; `slug` is the URL-safe name):

- `parishes/{id}`: `slug`, `nameEn`, `nameEl`, `city`, `address`, `groupIds[]`, `accentColor` (hex), `order`, `visible`
- `groups/{id}`: `slug`, `nameEn`, `nameEl`, `order`
- `services/{id}`: `parishId`, `date` (`YYYY-MM-DD`), `time` (`HH:mm`, 24 h), `titleEn`, `titleEl`, `notesEn`, `notesEl`, `updatedAt`
- `users/{uid}`: `uid`, `email`, `displayName`, `photoURL`, `providers` (`google` / `password`: how they sign in, shown to admins), `role` (`user` | `coordinator` | `admin` | `superadmin`), `parishIds` (list; only a coordinator has any), `createdAt`, `lastSignInAt`. Created by the person at first sign-in.
- `admins/{uid}`: retired, read-only; only used to carry the first superadmin over to `users/{uid}`.
- `settings/site`: `siteNameEn`, `siteNameEl`

Queries and indexes (`firestore.indexes.json`):
- all parishes: `services` where `date >= today`, ordered by `date`, `time` (index: date, time)
- one parish or a group: the same plus `parishId in [...]` (index: parishId, date, time). Firestore allows at most 30 values in `in`; the code takes the first 30 parishes of a group, so a group of more than 30 would be cut off silently.

Security rules (`firestore.rules`): everything is publicly readable except `users` and `admins`. `parishes`, `groups`, `settings` are written only by a superadmin. `services` can be created, changed or deleted only by someone who may edit the parish it belongs to (an admin or superadmin: any; a coordinator: the parishes on their profile; on a change, both the old and the new `parishId`). `users/{uid}`: read by its owner or an admin; created only by its owner as a plain `user`; the owner may refresh name, photo and last sign-in but never the role; roles are changed only by someone else, following the table above; only a superadmin deletes (the profile, not the sign-in account). `admins/{uid}`: read by its owner or a superadmin, never written.

## Implementation plan

1. **Design direction.** Done (Option A).
2. **Information architecture and data model.** First version done (above); recurring services and parish detail fields still open.
3. **Repo scaffold.** Done: project, folder layout, Firebase config files, rules, indexes, tests, `HANDOVER.md`.
4. **Public front-end.** Services, Parishes and About exist; About has no content, no parish detail page, favicon is still Vite's default.
5. **Admin back-end.** Sign-in and dashboard placeholder only. To build: parish, group, service (single and recurring) and user editors.
6. **Seed data and content entry.** Needs the real parish list, groups and starter schedules.
7. **QA and deploy.** Real-device check, emulator-based rules tests, Firebase deploy.
8. **Launch and handover.** First superadmin, onboarding of coordinators.

### Testing
- `npm test` (Vitest 5 + jsdom + Testing Library): 252 tests in 20 files. Firebase is always faked; no test touches the network or an emulator.
- `tests/schedule.test.ts`: NZ date around daylight-saving changes, English/Greek date text, scope resolution, hidden parishes.
- `tests/i18n.test.ts`: every string has real English and Greek text; the three agreed menu items.
- `tests/rules.test.ts`: **static** checks of `firestore.rules` and `firestore.indexes.json` against the code (every collection has a rule, no open writes, writes tied to the parish, the indexes the queries need). They read the files; they do not run the rules.
- `tests/layout.test.tsx`, `schedule-page.test.tsx`, `parishes-page.test.tsx`: header, language switching and persistence, the three scopes, loading state, Greek text, the layout classes the CSS relies on.
- `tests/layout-css.test.ts`: **static** checks of `src/index.css` for the small/large screen behaviour (left-aligned menu and headings, no width cap on large screens). jsdom does not apply media queries, so this is not a visual test; check real widths in a browser.
- `tests/authguard.test.tsx`, `tests/app.test.tsx`: routing, the lazy admin area with a faked sign-in, who may edit which parish.
- `tests/account.test.tsx`, `tests/google-signin.test.tsx`: the header Log in / Log out button and its hint, the Google button (Identity Services path, popup fallback, cancel and error messages, in-app browsers), and the "no admin access" notice.
- Tests use fixed timestamps, never the current time. When you add a field or a collection, update the types, the rules, the README data model and the tests together.

## Getting started

1. `npm install` (needs Node 22 or newer; Node 24 avoids some `EBADENGINE` warnings from Firebase packages)
2. `copy .env.example .env.local` and fill in the Firebase web-app values ([Firebase setup](#firebase-setup))
3. Put your Firebase project id in `.firebaserc`
4. `npm run dev`, `npm test`, `npm run build`, `npm run lint`

## Firebase setup

1. Create a Firebase project and a web app; copy the config values into `.env.local`.
2. **Firestore:** create the database. **The location cannot be changed afterwards**; choose it deliberately ([Open decisions](#open-decisions)).
3. **Authentication:** enable Email/Password and Google. Add the site's domain under Authorized domains.
4. Deploy rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`.
5. **First superadmin:** sign in once at `/admin/login` (a `users/{uid}` profile with role `user` is created), then in the Firestore console set that profile's `role` to `superadmin`. Everybody after that is promoted on My page → Users. (A project that still has the old `admins/{uid}` record keeps working: the record is carried over at the next sign-in.)
6. Hosting: `npm run build`, then `firebase deploy --only hosting` (SPA rewrite to `index.html` is already in `firebase.json`).

## Custom domain and Google sign-in
Google sign-in uses Google Identity Services (`src/admin/googleSignIn.ts`) with Firebase's popup as fallback, as in the author's `fishing-league` project. Settings: `VITE_GOOGLE_CLIENT_ID` (public; the project's "Web client (auto created by Google Service)") and `VITE_FIREBASE_AUTH_DOMAIN`. When a dedicated domain is added: Hosting custom domain; Authorized domains (domain and `www`); `VITE_FIREBASE_AUTH_DOMAIN=<domain>`; in Google Cloud, the web client's Authorized JavaScript origins (`https://<domain>`, `https://www.<domain>`) and Authorized redirect URIs (`https://<domain>/__/auth/handler`, the `www` version, and the `firebaseapp.com` one); rebuild and deploy; test on a phone. Details in `HANDOVER.md` section 9a.

## Secrets and configuration
- `.env.local` (git-ignored) holds the `VITE_FIREBASE_*` values. Anything starting with `VITE_` is public, so never put a real secret there. The Firebase web config is not secret; the rules are the protection.
- Never commit `.env*` (except `.env.example`), service-account JSON or keys; `.gitignore` already excludes them.

## Open decisions
- **Firestore location.** Not chosen. Permanent once created. A New Zealand audience suggests a nearby region (for example Sydney, `australia-southeast1`); confirm before creating the database.
- **Recurring services.** Today one document is one occurrence. Decide between generating occurrences from a weekly template (and overriding single days, e.g. feasts) and entering each date by hand.
- **Groups.** Are they geographic, diocesan or something else? Do all parishes belong to at least one? Who names them?
- **Parish detail.** Contact, priest, map link, a parish page of its own, patron saint icon for the accent.
- **About page** content (English and Greek).
- **Real data:** the list of parishes, their groups and current schedules, to seed from.
- **Domain name** and whether more languages are ever wanted.
