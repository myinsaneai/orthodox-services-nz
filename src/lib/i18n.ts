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
  servicesSub:     { en: 'Service schedules, feasts and fasting days — for all parishes, or choose one', el: 'Προγράμματα ακολουθιών, εορτές και νηστείες — για όλες τις ενορίες ή επιλέξτε μία' },
  allParishes:     { en: 'All parishes', el: 'Όλες οι ενορίες' },
  viewList:        { en: 'List', el: 'Λίστα' },
  viewCalendar:    { en: 'Calendar', el: 'Ημερολόγιο' },
  prevMonth:       { en: 'Previous month', el: 'Προηγούμενος μήνας' },
  nextMonth:       { en: 'Next month', el: 'Επόμενος μήνας' },
  thisMonth:       { en: 'This month', el: 'Τρέχων μήνας' },
  scheduleTitle:   { en: 'Service Schedule for', el: 'Πρόγραμμα ακολουθιών —' },
  copyTable:       { en: 'Copy', el: 'Αντιγραφή' },
  copyTableTitle:  { en: 'Copy the table to the clipboard (paste into Word)', el: 'Αντιγραφή του πίνακα στο πρόχειρο (επικόλληση στο Word)' },
  copied:          { en: 'Copied!', el: 'Αντιγράφηκε!' },
  copyFailed:      { en: 'Could not copy to the clipboard.', el: 'Η αντιγραφή στο πρόχειρο απέτυχε.' },
  noScheduleMonth: { en: 'No service schedule has been posted for this month yet.', el: 'Δεν έχει αναρτηθεί ακόμη πρόγραμμα ακολουθιών για αυτόν τον μήνα.' },
  noScheduleDay:   { en: 'No service schedule posted for this day yet.', el: 'Δεν έχει αναρτηθεί ακόμη πρόγραμμα ακολουθιών για αυτήν την ημέρα.' },
  showAllDays:     { en: 'Show all days', el: 'Εμφάνιση όλων των ημερών' },
  showPostedDays:  { en: 'Show only days with services', el: 'Μόνο ημέρες με ακολουθίες' },
  scheduleLoadFailed: { en: 'The schedule could not be loaded. Please try again later.', el: 'Το πρόγραμμα δεν ήταν δυνατό να φορτωθεί. Δοκιμάστε ξανά αργότερα.' },
  editSchedule:    { en: 'Edit schedule', el: 'Επεξεργασία προγράμματος' },
  editThisDay:     { en: 'Edit this day', el: 'Επεξεργασία ημέρας' },
  navSchedule:     { en: 'Schedule', el: 'Πρόγραμμα' },
  navTemplates:    { en: 'Templates', el: 'Πρότυπα' },
  serviceSchedule: { en: 'Service schedule', el: 'Πρόγραμμα ακολουθιών' },
  schedulePosted:  { en: 'Schedule posted', el: 'Αναρτημένο πρόγραμμα' },
  nzHoliday:       { en: 'NZ public holiday', el: 'Αργία στη Νέα Ζηλανδία' },
  legendPascha:    { en: 'Pascha', el: 'Πάσχα' },
  legendGreat:     { en: 'Great feast', el: 'Μεγάλη εορτή' },
  legendPalmPent:  { en: 'Palm Sunday / Pentecost', el: 'Βαΐων / Πεντηκοστή' },
  legendNativity:  { en: 'Nativity', el: 'Χριστούγεννα' },
  legendBright:    { en: 'Bright Week', el: 'Διακαινήσιμος' },
  legendHolyWeek:  { en: 'Holy Week', el: 'Μεγάλη Εβδομάδα' },
  fastingLegend:   { en: 'Fasting days', el: 'Ημέρες νηστείας' },
  fastingNote:     { en: 'Fasting follows common parish practice; your priest may direct otherwise.', el: 'Η νηστεία ακολουθεί την κοινή εκκλησιαστική πρακτική· ο πνευματικός ή ο εφημέριος μπορεί να υποδείξει διαφορετικά.' },
  parishesHeading: { en: 'Parishes', el: 'Ενορίες' },
  addParish:       { en: 'Add parish', el: 'Προσθήκη ενορίας' },
  editParish:      { en: 'Edit', el: 'Επεξεργασία' },
  moveParishUp:    { en: 'Move up', el: 'Μετακίνηση πάνω' },
  moveParishDown:  { en: 'Move down', el: 'Μετακίνηση κάτω' },
  reorderFailed:   { en: 'Could not change the order.', el: 'Η αλλαγή σειράς δεν ήταν δυνατή.' },
  otherState:      { en: 'Other', el: 'Άλλες' },
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
