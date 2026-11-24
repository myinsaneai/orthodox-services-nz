// src/admin/parishStorage.ts
// Parish photos in Firebase Storage: parishes/<parishId>/<time>.jpg (public to read, because the
// parish page is public; only admins write: see storage.rules).

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebaseAdmin';

/** Uploads the JPEG and returns its download address. */
export async function uploadParishPhoto(parishId: string, blob: Blob): Promise<string> {
  const r = ref(storage, `parishes/${parishId}/${Date.now()}.jpg`);
  await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
  return getDownloadURL(r);
}

/** Removes an uploaded photo again (used when the parish could not be saved). */
export async function removeParishPhoto(url: string): Promise<void> {
  try { await deleteObject(ref(storage, url)); } catch { /* best effort */ }
}
