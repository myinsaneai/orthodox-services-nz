// src/admin/parishStorage.ts
// Parish photos in Firebase Storage: parishes/<parishId>/<time>.jpg (public to read, because the
// parish page is public; only admins write: see storage.rules).

import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
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

/** Removes the parish's older photo files. With `keepUrl`, that one file stays (the new photo). */
export async function removeParishPhotos(parishId: string, keepUrl = ''): Promise<void> {
  try {
    const keep = decodeURIComponent(keepUrl);
    const { items } = await listAll(ref(storage, `parishes/${parishId}`));
    await Promise.all(items
      .filter(i => !keep || !keep.includes(`parishes/${parishId}/${i.name}`))
      .map(i => deleteObject(i).catch(() => {})));
  } catch { /* tidying up is best effort */ }
}
