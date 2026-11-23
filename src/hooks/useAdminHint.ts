// src/hooks/useAdminHint.ts
import { useSyncExternalStore } from 'react';
import { getAdminHint, subscribeAdminHint } from '../lib/authHint';

export function useAdminHint(): boolean {
  return useSyncExternalStore(subscribeAdminHint, getAdminHint, () => false);
}
