// src/contexts/AuthContext.tsx
// Admin auth. Role comes from admins/{uid}:
//   superadmin    → parishIds === 'all'
//   parish-admin  → parishIds is the list of parishes they may edit

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getAdminRecord } from '../lib/firestore';
import { auth } from '../lib/firebaseAdmin';

export type Role = 'superadmin' | 'parish-admin' | null;

interface AuthContextValue {
  user: User | null;
  role: Role;
  allowedParishes: string[] | 'all';
  loading: boolean;
  canEditParish: (parishId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, role: null, allowedParishes: [], loading: true, canEditParish: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [allowedParishes, setAllowedParishes] = useState<string[] | 'all'>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      // Re-enter loading on every auth change so AuthGuard doesn't redirect
      // before the role lookup below has finished.
      setLoading(true);
      setUser(firebaseUser);

      let nextRole: Role = null;
      let nextParishes: string[] | 'all' = [];
      if (firebaseUser) {
        try {
          const rec = await getAdminRecord(firebaseUser.uid);
          if (rec) { nextRole = rec.role; nextParishes = rec.parishIds; }
        } catch { /* treated as not an admin */ }
      }
      setRole(nextRole);
      setAllowedParishes(nextParishes);
      setLoading(false);
    });
  }, []);

  const canEditParish = (parishId: string) =>
    role === 'superadmin' ||
    (role === 'parish-admin' && Array.isArray(allowedParishes) && allowedParishes.includes(parishId));

  return (
    <AuthContext.Provider value={{ user, role, allowedParishes, loading, canEditParish }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
