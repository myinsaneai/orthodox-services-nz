# Greek Orthodox Parishes of New Zealand — Service Schedules

React + Vite + TypeScript + Firebase (Firestore, Auth, Hosting). One central site showing service schedules for a single parish, a named group of parishes, or all parishes. Structure follows the Russian parish site (`axces2000/russian-church`), extended to multiple parishes.

## Setup

1. `cp .env.example .env.local` and fill in the Firebase web-app config values
2. Set your Firebase project id in `.firebaserc`
3. `npm install`
4. `npm run dev`

Never commit `.env.local`.

## Folder structure

```
src/
  admin/        Admin-only pages (lazy-loaded as one chunk from App.tsx)
  components/   SiteLayout (header with seals + nav), AuthGuard, LangToggle
  contexts/     Auth (role + parish scope), Lang (EN / ΕΛ)
  hooks/        Custom hooks
  lib/          Firebase init, Firestore helpers + types, UI strings (i18n.ts)
  pages/        Public pages: SchedulePage, ParishesPage, AboutPage
  themes/       Design tokens (single locked design: Option A "Cathedral Classic")
  assets/seals/ Header seals (Ecumenical Patriarchate, Holy Metropolis of NZ)
```

## Routes

| Path | Page |
|---|---|
| `/services` | Upcoming services — all parishes |
| `/services?group=<slug>` | A named group of parishes |
| `/services?parish=<slug>` | A single parish |
| `/parishes` | Parish directory |
| `/about` | About |
| `/admin`, `/admin/login` | Admin (lazy-loaded) |

## Data model (Firestore)

- `parishes/{id}` — slug, nameEn/nameEl, city, address, groupIds[], accentColor, order, visible
- `groups/{id}` — slug, nameEn/nameEl, order
- `services/{id}` — parishId, date (YYYY-MM-DD), time (HH:mm), titleEn/El, notesEn/El
- `admins/{uid}` — role (`superadmin` | `parish-admin`), parishIds (`'all'` or list)
- `settings/site`

Security rules in `firestore.rules`: public read; superadmin manages parishes/groups/settings/admins; a parish-admin may create/edit/delete services only for parishes in their `parishIds`.

## Creating the first superadmin

1. Firebase Console → Authentication → Add user (email + password); copy the UID
2. Firestore → create `admins/{uid}`:
   ```
   uid:       <the UID>
   email:     <the email>
   role:      superadmin
   parishIds: all
   ```
3. Sign in at `/admin/login`

## Deploying

```bash
npm run build
firebase deploy
```

Requires `firebase login` and the project initialised (Hosting, Firestore, Storage). Deploy the indexes too (`firestore.indexes.json` is included in `firebase deploy`).

## Status

Scaffold only: public pages read from Firestore; admin has sign-in and a placeholder dashboard. Next: admin editors (parishes, groups, services, users), seed data, About content.
