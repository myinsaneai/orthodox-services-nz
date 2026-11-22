// src/lib/firebaseAdmin.ts
// Auth and Storage — used only by the admin panel. Kept out of ./firebase.ts
// so the public bundle never loads them. Only import this from code under
// src/admin (or modules that are only reached from there).

import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { app } from './firebase';

export const auth    = getAuth(app);
export const storage = getStorage(app);
