// src/lib/i18n.ts
// Small UI string table (EN / ΕΛ). Content from Firestore carries its own
// nameEn/nameEl fields; this is only for fixed interface text.

import type { Lang } from '../contexts/LangContext';

const strings = {
  siteTitle:       { en: 'Holy Metropolis of New Zealand (Fiji, Tonga & Samoa)', el: 'Ιερά Μητρόπολις Νέας Ζηλανδίας (Φίτζι, Τόνγκα και Σαμόα)' },
  siteSubtitle:    { en: 'Sacred Services', el: 'Ιερές Ακολουθίες' },
  navServices:     { en: 'Services', el: 'Ακολουθίες' },
  navParishes:     { en: 'Parishes', el: 'Ενορίες' },
  navAbout:        { en: 'About', el: 'Σχετικά' },
  servicesHeading: { en: 'Services', el: 'Ακολουθίες' },
  servicesSub:     { en: 'Upcoming across all parishes, or filter to one', el: 'Προσεχείς ακολουθίες σε όλες τις ενορίες ή φιλτράρετε μία' },
  allParishes:     { en: 'All parishes', el: 'Όλες οι ενορίες' },
  noServices:      { en: 'No upcoming services found.', el: 'Δεν βρέθηκαν προσεχείς ακολουθίες.' },
  parishesHeading: { en: 'Parishes', el: 'Ενορίες' },
  addParish:       { en: 'Add parish', el: 'Προσθήκη ενορίας' },
  editParish:      { en: 'Edit', el: 'Επεξεργασία' },
  viewMap:         { en: 'View on map', el: 'Δείτε στον χάρτη' },
  aboutHeading:    { en: 'About', el: 'Σχετικά' },
  loading:         { en: 'Loading…', el: 'Φόρτωση…' },
  logIn:           { en: 'Log in', el: 'Σύνδεση' },
  logOut:          { en: 'Log out', el: 'Αποσύνδεση' },
  navMyPage:       { en: 'My page', el: 'Η σελίδα μου' },
  navProfile:      { en: 'Profile', el: 'Προφίλ' },
  navUsers:        { en: 'Users', el: 'Χρήστες' },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}
