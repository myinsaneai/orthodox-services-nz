// src/lib/firestore.ts
// Typed helpers for all Firestore reads and writes (multi-parish data model).
//
// Collections
//   parishes/{parishId}   one doc per parish
//   groups/{groupId}      named groups of parishes (e.g. "Wellington group")
//   services/{serviceId}  one doc per service occurrence, tagged with parishId (old structured model)
//   serviceDays/{parishId}_{date}  one doc per parish per day: free-text schedule in English and Greek
//   users/{uid}           one profile per signed-in person: role + (coordinators) parishIds
//   admins/{uid}          retired: only read, once, to carry the first superadmin over to users/{uid}
//   settings/site         site-wide settings

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
  query, orderBy, where, serverTimestamp, updateDoc, limit, writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { isRole } from './roles';
import { signInMethods } from './signIn';
import { safePhotoUrl } from './photoUrl';
import type { SignInMethod } from './signIn';
import type { RoleName } from './roles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Parish {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  city: string;          // city in English (cityEl: the Greek spelling)
  address: string;
  state?: string;        // id from src/lib/states.ts (nz, fj, to, ws)
  cityEl?: string;
  descriptionEn?: string;
  descriptionEl?: string;
  mapUrl?: string;       // Google Maps link, '' when none
  photoURL?: string;     // Firebase Storage address of the parish photo, '' when none
  groupIds: string[];
  accentColor: string; // small per-parish accent (hex)
  order: number;
  visible: boolean;
}

export interface Group {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  order: number;
}

export interface Service {
  id: string;
  parishId: string;
  date: string;      // "YYYY-MM-DD" (NZ local date)
  time: string;      // "HH:mm" 24h, NZ local time
  titleEn: string;
  titleEl: string;
  notesEn: string;
  notesEl: string;
  updatedAt: unknown;
}

/** Retired collection admins/{uid}: kept only to carry the first superadmin over. */
export interface AdminRecord {
  uid: string;
  email: string;
  role: 'superadmin' | 'parish-admin';
  parishIds: string[] | 'all';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: RoleName;
  parishIds: string[];     // parishes a coordinator may edit; empty for every other role
  profileEdited: boolean;  // true once the person has set their own name or photo: Google's no longer overwrites them
  providers: SignInMethod[]; // how the person signs in; empty when not known yet (older profiles)
  createdAt: unknown;      // Firestore Timestamp
  lastSignInAt: unknown;   // Firestore Timestamp
}

export interface SiteSettings {
  siteNameEn: string;
  siteNameEl: string;
}

// ─── Parishes ─────────────────────────────────────────────────────────────────

export function subscribeParishes(cb: (p: Parish[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'parishes'), orderBy('order')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Parish))));
}
export async function saveParish(p: Parish) {
  await setDoc(doc(db, 'parishes', p.id), p, { merge: true });
}
/** A new parish (admins). It must not exist yet: the rules refuse overwriting. */
export async function createParish(p: Parish) {
  const { id, ...data } = p;                 // the id is the document name, not a field (the rules allow no extra fields)
  await setDoc(doc(db, 'parishes', id), data);
}
/** Saves changes to an existing parish (admins). The whole record is replaced; the id stays the name. */
export async function updateParish(p: Parish) {
  const { id, ...data } = p;
  await setDoc(doc(db, 'parishes', id), data);
}
/** Deletes a parish and every service that belongs to it (services first, so none is left pointing at nothing). */
export async function deleteParishAndServices(id: string) {
  const snap = await getDocs(query(collection(db, 'services'), where('parishId', '==', id)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'parishes', id));
}
export async function deleteParish(id: string) {
  await deleteDoc(doc(db, 'parishes', id));
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export function subscribeGroups(cb: (g: Group[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'groups'), orderBy('order')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Group))));
}
export async function saveGroup(g: Group) {
  await setDoc(doc(db, 'groups', g.id), g, { merge: true });
}
export async function deleteGroup(id: string) {
  await deleteDoc(doc(db, 'groups', id));
}

// ─── Services ─────────────────────────────────────────────────────────────────

// Firestore's `in` operator accepts at most 30 values.
const IN_LIMIT = 30;

/**
 * Upcoming services from `fromDate` ("YYYY-MM-DD") onward.
 * scope = 'all'          → every parish
 * scope = string[]       → only those parish ids (single parish or a group)
 */
export function subscribeUpcomingServices(
  scope: 'all' | string[],
  fromDate: string,
  cb: (s: Service[]) => void,
): Unsubscribe {
  const base = collection(db, 'services');
  const q = scope === 'all'
    ? query(base, where('date', '>=', fromDate), orderBy('date'), orderBy('time'))
    : query(base,
        where('parishId', 'in', scope.slice(0, IN_LIMIT)),
        where('date', '>=', fromDate), orderBy('date'), orderBy('time'));
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service))));
}
export async function saveService(s: Omit<Service, 'updatedAt'>) {
  await setDoc(doc(db, 'services', s.id), { ...s, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteService(id: string) {
  await deleteDoc(doc(db, 'services', id));
}

// ─── Service days (free-text schedule per parish per day) ──────────────────────

/** What a parish posts for one day, as text the way it would print it ("9:00 Orthros\n10:00 Divine Liturgy"). */
export interface ServiceDay {
  id: string;            // `${parishId}_${date}`
  parishId: string;
  date: string;          // "YYYY-MM-DD"
  yearMonth: string;     // "YYYY-MM" — lets a month be fetched with one equality filter (no composite index)
  entriesEn: string;
  entriesEl: string;
  updatedAt?: unknown;
}

/** Every posted day of every parish in one month ("YYYY-MM"). Scope and visibility are applied by the caller. */
export function subscribeServiceDaysForMonth(
  yearMonth: string,
  cb: (days: ServiceDay[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'serviceDays'), where('yearMonth', '==', yearMonth)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceDay))),
    err => onError?.(err),
  );
}

// ─── Users and roles ──────────────────────────────────────────────────────────

/** Milliseconds from a Firestore Timestamp / Date / number; 0 when unknown. */
export function toMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const t = v as { toMillis?: () => number };
  return typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

/** Retired: only used once, to find out whether a new profile belongs to the old superadmin. */
export async function getAdminRecord(uid: string): Promise<AdminRecord | null> {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminRecord) : null;
}

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

const asProfile = (uid: string, d: Record<string, unknown>): UserProfile => ({
  uid,
  email: String(d.email ?? ''),
  displayName: String(d.displayName ?? ''),
  photoURL: String(d.photoURL ?? ''),
  role: isRole(d.role) ? d.role : 'user',
  parishIds: Array.isArray(d.parishIds) ? (d.parishIds as string[]) : [],
  profileEdited: d.profileEdited === true,
  providers: Array.isArray(d.providers) ? (d.providers as unknown[]).filter((m): m is SignInMethod => m === 'google' || m === 'password') : [],
  createdAt: d.createdAt ?? null,
  lastSignInAt: d.lastSignInAt ?? null,
});

/**
 * Called after every sign-in. Returns the person's profile, creating it the first
 * time (role "user"). The old admins/{uid} superadmin is carried over as superadmin.
 * Name, photo and "last sign-in" are refreshed at most twice a day.
 */
export async function ensureUserProfile(
  u: {
    uid: string; email: string | null; displayName: string | null; photoURL: string | null;
    providerData?: { providerId: string }[];
  },
): Promise<UserProfile> {
  const ref = doc(db, 'users', u.uid);
  const fresh = { email: u.email ?? '', displayName: u.displayName ?? '', photoURL: safePhotoUrl(u.photoURL) };
  const providers = signInMethods(u.providerData);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const profile = asProfile(u.uid, snap.data());
    // Once the person has set their own name or photo, the sign-in provider's no longer overwrite them.
    const own = profile.profileEdited
      ? { displayName: profile.displayName, photoURL: profile.photoURL }
      : { displayName: fresh.displayName, photoURL: fresh.photoURL };
    const stale = Date.now() - toMillis(profile.lastSignInAt) > REFRESH_AFTER_MS;
    const changed = profile.email !== fresh.email || profile.displayName !== own.displayName
      || profile.photoURL !== own.photoURL || profile.providers.join() !== providers.join();
    if (stale || changed) {
      try {
        await updateDoc(ref, { email: fresh.email, ...own, providers, lastSignInAt: serverTimestamp() });
      } catch { /* best effort */ }
    }
    return { ...profile, email: fresh.email, ...own, providers };
  }

  let legacy: AdminRecord | null = null;
  try { legacy = await getAdminRecord(u.uid); } catch { /* no old record */ }
  const role: RoleName = legacy?.role === 'superadmin' ? 'superadmin' : 'user';
  try {
    await setDoc(ref, {
      uid: u.uid, ...fresh, providers, role, parishIds: [],
      createdAt: serverTimestamp(), lastSignInAt: serverTimestamp(),
    });
  } catch (err) {
    // The rules still treat the old superadmin as superadmin, so the screen should too.
    if (role === 'superadmin') return asProfile(u.uid, { ...fresh, providers, role });
    throw err;
  }
  return asProfile(u.uid, { ...fresh, providers, role, createdAt: new Date(), lastSignInAt: new Date() });
}

/** The signed-in person edits their own name and photo (photoURL '' = no photo). */
export async function updateOwnProfile(uid: string, p: { displayName: string; photoURL: string }) {
  await updateDoc(doc(db, 'users', uid), { displayName: p.displayName, photoURL: p.photoURL, profileEdited: true });
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, 'users'), limit(2000)));
  return snap.docs.map(d => asProfile(d.id, d.data()));
}

/** Parish list is kept only for coordinators; every other role has none. */
export async function setUserRole(uid: string, role: RoleName, keepParishIds: string[] = []) {
  await updateDoc(doc(db, 'users', uid), {
    role,
    parishIds: role === 'coordinator' ? keepParishIds : [],
  });
}

/** Removes the profile (role and favourites) only; the sign-in account itself stays. */
export async function deleteUserProfile(uid: string) {
  await deleteDoc(doc(db, 'users', uid));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  return snap.exists() ? (snap.data() as SiteSettings) : null;
}
export async function updateSiteSettings(data: Partial<SiteSettings>) {
  await setDoc(doc(db, 'settings', 'site'), data, { merge: true });
}
