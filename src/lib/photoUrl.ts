// src/lib/photoUrl.ts
// Which addresses may be stored as a person's photo: Google account pictures and our own
// Firebase Storage. Anything else is dropped, so nobody can make the Users page (seen by
// admins) load a picture from a stranger's server. firestore.rules holds the same pattern
// (a test keeps the two identical).

export const PHOTO_URL_PATTERN =
  'https://([a-z0-9-]+[.])+googleusercontent[.]com/.*|https://firebasestorage[.]googleapis[.]com/.*';

const RE = new RegExp(`^(?:${PHOTO_URL_PATTERN})$`);

/** The address if it is allowed, otherwise an empty string. */
export function safePhotoUrl(url: string | null | undefined): string {
  return url && url.length <= 2000 && RE.test(url) ? url : '';
}
