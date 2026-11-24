// src/admin/pendingName.ts
// The name a new person typed on the registration screen. Firebase signs them in the
// moment the account exists, before their name can be attached to it, and the profile
// is created at that moment: AuthContext takes the name from here so the profile is
// right from the start. Used once, then forgotten.

let pending = '';

export function setPendingName(name: string): void { pending = name; }

export function takePendingName(): string {
  const n = pending;
  pending = '';
  return n;
}
