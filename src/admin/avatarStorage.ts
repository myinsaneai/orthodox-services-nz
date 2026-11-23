// src/admin/avatarStorage.ts
// Profile photos in Firebase Storage: avatars/<uid>/<time>.jpg. A new file name each time
// avoids stale browser caches; older files of the same person are removed afterwards.

import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebaseAdmin';

async function removeOthers(uid: string, keep?: string) {
  try {
    const { items } = await listAll(ref(storage, `avatars/${uid}`));
    await Promise.all(items.filter(i => i.name !== keep).map(i => deleteObject(i).catch(() => {})));
  } catch { /* tidying up is best effort */ }
}

/** Uploads the JPEG and returns its download address. */
export async function uploadAvatar(uid: string, blob: Blob): Promise<string> {
  const name = `${Date.now()}.jpg`;
  const r = ref(storage, `avatars/${uid}/${name}`);
  await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
  const url = await getDownloadURL(r);
  await removeOthers(uid, name);
  return url;
}

/** Deletes every photo file of this person. */
export async function removeAvatars(uid: string): Promise<void> {
  await removeOthers(uid);
}
