// src/lib/i18n.ts
// Small UI string table (EN / ΕΛ). Content from Firestore carries its own
// nameEn/nameEl fields; this is only for fixed interface text.

import type { Lang } from '../contexts/LangContext';

const strings = {
  siteTitle:       { en: 'Greek Orthodox Parishes of New Zealand', el: 'Ελληνορθόδοξες Ενορίες Νέας Ζηλανδίας' },
  navServices:     { en: 'Services', el: 'Ακολουθίες' },
  navParishes:     { en: 'Parishes', el: 'Ενορίες' },
  navAbout:        { en: 'About', el: 'Σχετικά' },
  servicesHeading: { en: 'Services & Sacred Mysteries', el: 'Ακολουθίες & Μυστήρια' },
  servicesSub:     { en: 'Upcoming across all parishes, or filter to one', el: 'Προσεχείς ακολουθίες σε όλες τις ενορίες ή φιλτράρετε μία' },
  allParishes:     { en: 'All parishes', el: 'Όλες οι ενορίες' },
  noServices:      { en: 'No upcoming services found.', el: 'Δεν βρέθηκαν προσεχείς ακολουθίες.' },
  parishesHeading: { en: 'Parishes', el: 'Ενορίες' },
  aboutHeading:    { en: 'About', el: 'Σχετικά' },
  loading:         { en: 'Loading…', el: 'Φόρτωση…' },
  logIn:           { en: 'Log in', el: 'Σύνδεση' },
  logOut:          { en: 'Log out', el: 'Αποσύνδεση' },
  navMyPage:       { en: 'My page', el: 'Η σελίδα μου' },
  navUsers:        { en: 'Users', el: 'Χρήστες' },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}
