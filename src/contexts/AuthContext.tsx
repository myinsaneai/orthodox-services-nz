// src/contexts/AuthContext.tsx
// Admin-area auth. Everybody who signs in has a profile at users/{uid}; its role
// (user / coordinator / admin / superadmin, see src/lib/roles.ts) comes from there.
// Role null = nobody signed in, or the profile could not be loaded.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ensureUserProfile } from '../lib/firestore';
import type { UserProfile } from '../lib/firestore';
import { auth } from '../lib/firebaseAdmin';
import { setRoleHint } from '../lib/authHint';
import { isAtLeast } from '../lib/roles';
import type { RoleName } from '../lib/roles';

export type Role = RoleName | null;

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: Role;
  allowedParishes: string[] | 'all';
  loading: boolean;
  applyProfile: (patch: Partial<UserProfile>) => void;   // after the person saved their own profile
  canEditParish: (parishId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, role: null, allowedParishes: [], loading: true, applyProfile: () => {}, canEditParish: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      // Re-enter loading on every auth change so AuthGuard doesn't redirect
      // before the profile lookup below has finished.
      setLoading(true);
      setUser(firebaseUser);

      let next: UserProfile | null = null;
      if (firebaseUser) {
        try { next = await ensureUserProfile(firebaseUser); } catch { /* role stays null */ }
      }
      setProfile(next);
      setRoleHint(next ? next.role : null);   // display hint for the public header
      setLoading(false);
    });
  }, []);

  const role: Role = profile ? profile.role : null;
  const allowedParishes: string[] | 'all' =
    isAtLeast(role, 'admin') ? 'all' : role === 'coordinator' ? profile!.parishIds : [];

  const applyProfile = (patch: Partial<UserProfile>) => setProfile(p => (p ? { ...p, ...patch } : p));

  const canEditParish = (parishId: string) =>
    allowedParishes === 'all' || (Array.isArray(allowedParishes) && allowedParishes.includes(parishId));

  return (
    <AuthContext.Provider value={{ user, profile, role, allowedParishes, loading, applyProfile, canEditParish }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
