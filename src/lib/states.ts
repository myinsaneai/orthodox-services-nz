// src/lib/states.ts
// The states / territories a parish can belong to, in the order they are listed.
// To add one or change the order, edit this list (firestore.rules only checks the text length).

export interface ParishState { id: string; nameEn: string; nameEl: string }

export const PARISH_STATES: ParishState[] = [
  { id: 'nz', nameEn: 'New Zealand', nameEl: 'Νέα Ζηλανδία' },
  { id: 'fj', nameEn: 'Fiji',        nameEl: 'Φίτζι' },
  { id: 'to', nameEn: 'Tonga',       nameEl: 'Τόνγκα' },
  { id: 'ws', nameEn: 'Samoa',       nameEl: 'Σαμόα' },
];

export const stateById = (id: string | undefined): ParishState | undefined =>
  PARISH_STATES.find(s => s.id === id);
