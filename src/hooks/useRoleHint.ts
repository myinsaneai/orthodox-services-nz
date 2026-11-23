// src/hooks/useRoleHint.ts
import { useSyncExternalStore } from 'react';
import { getRoleHint, subscribeRoleHint } from '../lib/authHint';
import type { RoleName } from '../lib/roles';

export function useRoleHint(): RoleName | null {
  return useSyncExternalStore(subscribeRoleHint, getRoleHint, () => null);
}
