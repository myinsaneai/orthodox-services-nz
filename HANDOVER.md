# Orthodox Services NZ: handover for a new working session

Read this file and `README.md` first. The README holds the requirements, data model and phase plan. This file holds everything else: decisions, how we work, how the code is laid out, traps already hit, and what is next. The repo is the source of truth, so clone it instead of asking for files to be pasted.

## 1. Snapshot (as of the scaffold, tests and handover commits, late November 2026)
- **What:** website with the service schedules of the parishes of the Greek Orthodox Church in New Zealand and Oceania. Views: one parish, a named group of parishes, all parishes. English and Greek, mobile-friendly. Roles: visitor, parish admin, superadmin.
- **Repo:** https://github.com/myinsaneai/orthodox-services-nz. Local path on the developer's machine: `C:\React\orthodox-schedule-nz` (Windows, PowerShell). The folder name differs from the repo name; that does not matter to git.
- **Firebase project:** **not created yet.** `.firebaserc` holds the placeholder `REPLACE-WITH-FIREBASE-PROJECT-ID`; `.env.local` does not exist. Nothing has been deployed, so there is no live site.
- **People:** the developer is Alexei. He chose the design himself after reviewing four mock-ups.
- **Live status:** nothing is live. Verified so far: unit/component tests with faked Firebase, a production build, a clean `npm audit`, and a look at the public pages in a headless browser at 1100 and 390 px wide in English and Greek (no horizontal overflow, header and seals correct) **with no data** (empty Firestore).
- **Design:** Option A "Cathedral Classic": maroon `#7A1F0A` header with the two seals flanking the title, cream `#F3E8D9` hero band, gold `#C9A66C` accents, Cormorant Garamond + Nunito Sans. The Option A prototype is on a private Claude page only the developer can open: https://claude.ai/artifact/EjUVe3aM9kHMUW8WnZevQK. The code is now the design reference.

## 2. How we work (please keep doing this)
1. The assistant builds changes in a clone of the repo, runs `npm test`, the build and `npm audit`, and delivers a **zip of only the changed files** plus a short summary.
2. The developer unzips over the project (overwriting), runs `npm install` if `package.json` changed, then `npm test`, deploys (`firebase deploy --only ...`), tests on a phone, then commits and pushes.
3. The assistant then **verifies the pushed commit on a fresh `git clone`**: files identical to what was sent, clean `npm ci`, build, tests, audit, no secrets tracked.
4. Style: concise English, plain words, commands for **PowerShell**, at most one question per reply, state assumptions instead of asking when a sensible default exists. Mention anything not verified live (rules, sign-in, deploys).
5. When something "doesn't change", check the file on disk (`Select-String -Path ... -Pattern ...`) before debugging; a zip unzipped into the wrong folder was the usual cause in the sister project.
6. The assistant does not commit for the developer: it leaves the changes in the working tree and delivers the zip.

**Saving tokens in a new session:** do not print or rewrite whole files. Use `git clone`, `grep`, and small targeted edits (Python `str.replace` with an assert that the old text exists). Re-use the test patterns already in `tests/`. Do not repeat the README back.

## 3. Stack
- Frontend: React 19, TypeScript 7, Vite 8, React Router 7, Firebase web SDK 13, plain CSS variables plus inline styles. No UI library.
- Lint: `oxlint` (what the Vite template ships), not ESLint. It reports two `only-export-components` warnings for the context files (a provider and its hook in one file); accepted, same pattern as the Russian parish site.
- Tests: Vitest 5 + jsdom + Testing Library (`npm test` = `vitest run tests`). **79 tests in 8 files**, all passing. `tests/` is not part of `tsc -b` (the tsconfig includes `src` only), so test files are not type-checked; Vitest still transforms them.
- `npm audit`: 0 vulnerabilities. The root `package.json` has an `overrides` entry pinning `@grpc/grpc-js` to `^1.14.0` (Firestore pulled in a vulnerable 1.13.x; same fix as in `fishing-league`). Do not use `npm audit fix --force`: it proposes downgrading `firebase` to 9.x.
- No Cloud Functions, no emulator, no Storage uploads yet.
- Env: `.env.local` holds `VITE_FIREBASE_*` (see `.env.example`). Anything `VITE_` is public.

## 4. Repo map
`src/`
- `main.tsx` (mounts `App`), `App.tsx` (routes; the admin area is `React.lazy`), `index.css` (CSS variables, base, seal size).
- `components/`: `SiteLayout.tsx` (header with seals, nav, language switch), `LangToggle.tsx`, `AuthGuard.tsx` (`requireSuperAdmin`).
- `contexts/`: `LangContext.tsx` (`en` | `el`, saved as `gp_lang`, sets `<html lang>`), `AuthContext.tsx` (role from `admins/{uid}`, `allowedParishes`, `canEditParish`).
- `lib/`: `firebase.ts` (app + Firestore only), `firebaseAdmin.ts` (Auth + Storage; admin code only), `firestore.ts` (types and all reads/writes), `schedule.ts` (pure helpers: `todayNZ`, `formatWhen`, `resolveScope`, `scopeKey`, `visibleServices`), `i18n.ts` (fixed UI strings, EN/EL).
- `pages/`: `SchedulePage.tsx`, `ParishesPage.tsx`, `AboutPage.tsx` (placeholder).
- `admin/`: `AdminApp.tsx` (routes: `login`, index = dashboard), `LoginPage.tsx`, `AdminDashboard.tsx` (placeholder).
- `themes/tokens.ts` (design tokens, default parish accent), `assets/seals/` (the two seal PNGs, 232 px source), `hooks/` (empty).

Root: `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json`, `.firebaserc`, `.env.example`, `tests/`, `README.md`, this file.

Routes: `/` → `/services`, `/services` (`?group=<slug>` or `?parish=<slug>`), `/parishes`, `/about`, `/admin`, `/admin/login`; anything else → `/services`.

## 5. What is built
Public Services page with the three scopes (chips for All and each group, a drop-down for one parish, all in the URL); Parishes directory linking to each parish's schedule; About placeholder; English/Greek switch with first-visit detection; the Option A header with both seals; admin sign-in (email + password), role lookup, and a placeholder dashboard; Firestore types and helpers for parishes, groups, services, admins and settings; rules and indexes; the test suite.

Not built: any admin editor (parishes, groups, services, users), recurring services, parish detail pages, About content, seed data, error and offline states, favicon and manifest, any Storage use.

## 6. Decisions already made
- **Design:** Option A. Options B (directory-first, light header), C (ornamented, stripe divider) and D (true meander divider) were mocked up and not used; do not bring them back without being asked. Header seals are 100 px (56 px on phones), taken from a 232 px source for sharpness.
- **Menu:** exactly Services, Parishes, About plus the language switch. A test enforces the three items.
- **One design for all parishes**, with only a small per-parish accent (`accentColor`: the coloured bar on a service card and the dot in the directory). No per-parish themes, no theme switcher (unlike the Russian site's `themes/`).
- **Roles:** `superadmin` (`parishIds: 'all'`) and `parish-admin` (`parishIds` list). A parish admin edits services of listed parishes only. Parishes, groups, settings and admin records are superadmin-only. A `parish-admin` record with `parishIds: 'all'` is treated as able to edit nothing (tested) rather than as a superadmin.
- **Times are New Zealand wall-clock strings** (`date` `YYYY-MM-DD`, `time` `HH:mm`) shown as written; "today" is the NZ date (`todayNZ`). There is no time-zone conversion anywhere, so daylight saving cannot shift a service. Do not switch to Firestore Timestamps without a reason.
- **Bilingual content** is stored as paired fields (`...En`, `...El`). In Greek, a missing `titleEl` or `notesEl` falls back to the English text; names are not optional in either language.
- **Visibility:** a parish with `visible: false` is not listed, not selectable, and none of its services show, even in the "all parishes" view (filtered in the browser by `visibleServices`, because the query cannot filter on another document). A group or parish slug that does not resolve shows "no services", never everything.
- **Public / admin split** (same idea as the Russian site): Auth and Storage live only in `firebaseAdmin.ts`, reached only through the lazy admin chunk. A test checks that public pages do not start the auth listener.
- **No public sign-up.** Admin accounts are created by hand in the Firebase console and given a role by a superadmin.
- **Order of services** comes from the query (`date`, then `time`), not from the browser.

## 7. Traps already hit (do not repeat)
- **Never define a component inside another component** (inputs lose focus on every keystroke): use module-level components.
- **Never import `firebaseAdmin.ts` or `AuthContext` from public code.** It would pull `firebase/auth` into every visitor's bundle.
- Adding a field to a parish, group or service means touching **five places**: the type in `lib/firestore.ts`, the editor form (when it exists), `firestore.rules` (when it validates fields), the README data model, and the tests.
- **Firestore's `in` operator takes at most 30 values.** `subscribeUpcomingServices` takes the first 30 parish ids of a group and drops the rest silently. Fine for a country this size; if a group could exceed 30, split into several queries.
- **The Firestore location is permanent** once the database is created. Decide it before clicking Create.
- **The Services page needs two composite indexes** (`date,time` and `parishId,date,time`), listed in `firestore.indexes.json`. Until `firebase deploy --only firestore:indexes` has been run, the queries fail with a "requires an index" error in the console.
- In tests, **`getByText(/Holy Trinity/)` also matches the parish `<option>` in the drop-down**. Match the service row text (`/Holy Trinity, Wellington —/`) instead.
- Tests must not depend on the clock: pass a fixed `Date` to `todayNZ`, and use fixed dates in services. Date text checks use loose regexes because ICU output (`Sun, 6 Dec` vs `Sun 6 Dec`) varies between Node versions.
- `npm install` prints `EBADENGINE` warnings for some `@firebase/*` packages on Node 22. They are harmless so far; Node 24 removes them.
- **`public/favicon.svg` and `public/icons.svg` are still the Vite template's.** Replace them before launch.
- The **fonts** come from Google Fonts. In an offline or sandboxed browser the page falls back to a generic serif, so screenshots there do not show the real typography.
- The assistant's container shell is `sh`; use `bash` scripts for anything with `<( )`, and wrap long commands in `timeout`.
- A static check of `firestore.rules` is not a rules test. Do not claim the rules are verified until emulator tests exist.

## 8. Verified live and not verified live
**Confirmed working live:** nothing (no Firebase project yet).

**Not yet confirmed (all of it):**
- Anything against a real Firebase project: reading parishes/groups/services, the two composite indexes, Auth sign-in, the `admins/{uid}` role lookup, the lazy admin chunk loading in production.
- **Firestore and Storage rules** are checked only by reading and by `tests/rules.test.ts` (static). No emulator has ever been run.
- **Offline or failing Firestore:** with a bogus project the Services page showed "No upcoming services found." within a second, which would also be what a visitor with no connection sees. There is no error or offline state yet (`onSnapshot` has no error callback and `snap.metadata.fromCache` is ignored). Treat "no services" as unreliable until this is handled.
- Real phones and real data: layout was only checked with an empty list; service cards were checked in tests (markup, accent colour, Greek text), not in a browser.
- Greek wording of the UI strings was written by the assistant and has not been reviewed by a Greek speaker.

## 9. Open questions
See README "Open decisions": Firestore location, recurring services, what a group is, parish detail fields, About content, the real parish list, domain name. The two that block the next steps are the **Firestore location** and the **real parish list and groups**.

## 9a. Outside the repository (check these in a new thread before debugging)
- **GitHub:** `myinsaneai/orthodox-services-nz` was created empty; the first push is done by the developer from `C:\React\orthodox-schedule-nz`. The first commit in the zip was authored as "Claude"; the developer re-authors it with `git commit --amend --reset-author --no-edit` before the first push.
- **Firebase console (to do):** create the project and a web app; create Firestore (choose the location); enable Authentication → Email/Password; add Authorized domains; add the first user and the `admins/{uid}` document (README, "Firebase setup").
- **Developer's machine (git-ignored):** `.env.local` with the `VITE_FIREBASE_*` values, and the project id in `.firebaserc`.
- **Seals:** the two source images (Ecumenical Patriarchate, Holy Metropolis of New Zealand, the new version covering Fiji, Tonga and Samoa, 1970) are the client's files, kept in `src/assets/seals/`.

## 10. Next steps
1. Developer: first push to GitHub; create the Firebase project; fill `.env.local` and `.firebaserc`; deploy rules and indexes; create the first superadmin. (Decide the Firestore location first.)
2. Error and offline states on the three Firestore-backed pages (no more false "no services"), with tests.
3. Seed data: a script or a superadmin-only screen to load the real parishes, groups and starter services (needs the real list).
4. Admin editors: parishes, groups, services (single entries first, then recurring templates with feast-day overrides), users (assigning `parishIds`). Each parish-scoped screen must respect `canEditParish`.
5. About page content (EN and EL) and parish detail fields (contact, priest, map link, patron saint).
6. Favicon, web manifest and social image; `<title>`/description per language.
7. Emulator-based rules tests (needs Java and the emulator download), to replace the static checks.
8. Real-device QA (phones, Greek text, long titles, many services), accessibility pass.
9. Smaller: export or print view of a week's schedule, a calendar (.ics) link per parish, pagination if lists grow, more than 30 parishes in a group.

## 11. Starter prompt for the new thread
> Continue the Orthodox Services NZ project (React + Vite + Firebase, service schedules for Greek Orthodox parishes in New Zealand). Repo: https://github.com/myinsaneai/orthodox-services-nz (public). First clone it and read `README.md` and `HANDOVER.md`; do not ask me to paste files. Follow the working agreement in section 2 of HANDOVER.md (zip of changed files, tests, then verify my commit on a fresh clone). Keep replies concise and avoid reprinting large files. Then read sections 8 to 10 (what is confirmed, what is not, the settings that live outside the repository, next steps). First task: <describe it>.
