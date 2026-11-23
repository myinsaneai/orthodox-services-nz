// src/lib/roles.ts
// The four roles and who may give them to whom. Pure functions, no Firebase.
// firestore.rules enforces the same table on the server: keep the two in step.
//
//   user         saves favourite parishes, can apply to become a coordinator
//   coordinator  as user, and edits the schedule of the parishes assigned to them
//   admin        as coordinator, and assigns user / coordinator / admin roles
//                (only to people who are currently user or coordinator)
//   superadmin   as admin, and assigns any role including superadmin, may change
//                other admins and superadmins, and may delete users
// Nobody can change their own role or delete themselves.

export type RoleName = 'user' | 'coordinator' | 'admin' | 'superadmin';

export const ROLES: RoleName[] = ['user', 'coordinator', 'admin', 'superadmin'];

export const ROLE_LABEL: Record<RoleName, string> = {
  user: 'User',
  coordinator: 'Coordinator',
  admin: 'Admin',
  superadmin: 'SuperAdmin',
};

export const isRole = (v: unknown): v is RoleName => ROLES.includes(v as RoleName);

/** Position in the ladder; -1 for nobody (not signed in). */
export const rank = (r: RoleName | null | undefined): number => (r ? ROLES.indexOf(r) : -1);

export const isAtLeast = (r: RoleName | null | undefined, min: RoleName): boolean => rank(r) >= rank(min);

/** Roles `actor` may give to someone who currently has role `target`. Empty = may not change them. */
export function assignableRoles(actor: RoleName | null, target: RoleName): RoleName[] {
  if (actor === 'superadmin') return ROLES;
  if (actor === 'admin' && rank(target) <= rank('coordinator')) return ['user', 'coordinator', 'admin'];
  return [];
}

export function canChangeRole(
  actor: RoleName | null, actorUid: string, target: RoleName, targetUid: string,
): boolean {
  return actorUid !== targetUid && assignableRoles(actor, target).length > 0;
}

export function canDeleteUser(actor: RoleName | null, actorUid: string, targetUid: string): boolean {
  return actor === 'superadmin' && actorUid !== targetUid;
}
