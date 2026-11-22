// src/lib/firestore.ts
// Typed helpers for all Firestore reads and writes (multi-parish data model).
//
// Collections
//   parishes/{parishId}   one doc per parish
//   groups/{groupId}      named groups of parishes (e.g. "Wellington group")
//   services/{serviceId}  one doc per service occurrence, tagged with parishId
//   admins/{uid}          role + which parishes the admin may edit
//   settings/site         site-wide settings

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
  query, orderBy, where, serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Parish {
  id: string;
  slug: string;
  nameEn: string;
  nameEl: string;
  city: string;
  address: string;
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

export interface AdminRecord {
  uid: string;
  email: string;
  role: 'superadmin' | 'parish-admin';
  parishIds: string[] | 'all'; // 'all' for superadmin
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

// ─── Admins ───────────────────────────────────────────────────────────────────

export async function getAdminRecord(uid: string): Promise<AdminRecord | null> {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminRecord) : null;
}
export async function getAdmins(): Promise<AdminRecord[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminRecord));
}
export async function saveAdmin(a: AdminRecord) {
  await setDoc(doc(db, 'admins', a.uid), a, { merge: true });
}
export async function deleteAdmin(uid: string) {
  await deleteDoc(doc(db, 'admins', uid));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  return snap.exists() ? (snap.data() as SiteSettings) : null;
}
export async function updateSiteSettings(data: Partial<SiteSettings>) {
  await setDoc(doc(db, 'settings', 'site'), data, { merge: true });
}
