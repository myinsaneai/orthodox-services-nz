// src/admin/ProfilePage.tsx
// My page → Profile: every signed-in person changes their own display name and photo.
// The photo is shrunk in the browser (longest side at most 1024 px), stored in Firebase
// Storage, and its address saved on the person's profile.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateOwnProfile } from '../lib/firestore';
import { signInLabel } from '../lib/signIn';
import { ROLE_LABEL } from '../lib/roles';
import { checkImageFile, resizeImage } from '../lib/image';
import AvatarDropzone from './AvatarDropzone';
import { uploadAvatar, removeAvatars } from './avatarStorage';

const NAME_MAX = 60;

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function ProfilePage() {
  const { user, profile, applyProfile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [pending, setPending] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [working, setWorking] = useState(false);     // shrinking the picture
  const [busy, setBusy] = useState(false);           // saving
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const urlRef = useRef('');

  // Release the preview address when it is replaced and when leaving the page.
  useEffect(() => {
    const prev = urlRef.current;
    urlRef.current = pending?.url ?? '';
    if (prev && prev !== urlRef.current) URL.revokeObjectURL(prev);
  }, [pending]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  if (!user || !profile) return null;

  const shownPhoto = pending ? pending.url : removed ? '' : profile.photoURL;
  const trimmed = name.trim();
  const dirty = trimmed !== profile.displayName || !!pending || removed;

  const pick = async (file: File) => {
    setSaved(false);
    const problem = checkImageFile(file);
    if (problem) { setError(problem); return; }
    setError(''); setWorking(true);
    try {
      const out = await resizeImage(file);
      setPending({ blob: out.blob, url: URL.createObjectURL(out.blob), width: out.width, height: out.height });
      setRemoved(false);
    } catch {
      setError('We could not read that picture. Please try a different one.');
    }
    setWorking(false);
  };

  const save = async () => {
    if (!trimmed) { setError('Please enter a name.'); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      let photoURL = profile.photoURL;
      if (pending) photoURL = await uploadAvatar(user.uid, pending.blob);
      else if (removed) { photoURL = ''; await removeAvatars(user.uid); }
      await updateOwnProfile(user.uid, { displayName: trimmed, photoURL });
      applyProfile({ displayName: trimmed, photoURL, profileEdited: true });
      setPending(null); setRemoved(false); setName(trimmed); setSaved(true);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(code.startsWith('storage/')
        ? 'The photo could not be uploaded. Check your connection and try again.'
        : 'Could not save. Check your connection and try again.');
    }
    setBusy(false);
  };

  const discard = () => { setName(profile.displayName); setPending(null); setRemoved(false); setError(''); };

  return (
    <>
      <div className="hero">
        <h1>Profile</h1>
        <div className="hero-sub">Your name and photo, as other people see them.</div>
      </div>
      <div className="page pf">
        <div className="pf-photo">
          {shownPhoto
            ? <img className="pf-avatar" src={shownPhoto} alt="Your photo" referrerPolicy="no-referrer" />
            : <span className="pf-avatar pf-avatar--empty" aria-label="No photo yet">
                {(trimmed || profile.email).slice(0, 1).toUpperCase()}
              </span>}
          <div className="pf-drop">
            <AvatarDropzone onFile={pick} disabled={busy || working} />
            {working && <p className="um-muted" role="status">Preparing the picture…</p>}
            {pending && !working && (
              <p className="um-muted" role="status">
                New photo ready: {pending.width} × {pending.height} px, {kb(pending.blob.size)}. Press Save to keep it.
              </p>
            )}
            {(profile.photoURL || pending) && !removed && (
              <button type="button" className="um-btn" disabled={busy}
                      onClick={() => { setPending(null); setRemoved(true); setSaved(false); }}>
                Remove photo
              </button>
            )}
            {removed && <p className="um-muted" role="status">The photo will be removed when you press Save.</p>}
          </div>
        </div>

        <label className="pf-field">
          <span>Display name</span>
          <input type="text" value={name} maxLength={NAME_MAX} autoComplete="name"
                 onChange={e => { setName(e.target.value); setSaved(false); }} />
        </label>

        <dl className="pf-facts">
          <dt>Email</dt><dd>{profile.email}</dd>
          <dt>Role</dt><dd>{ROLE_LABEL[profile.role]}</dd>
          <dt>Signs in with</dt><dd>{signInLabel(profile.providers)}</dd>
        </dl>

        {error && <p role="alert" className="um-error">{error}</p>}
        {saved && <p role="status" className="um-muted">Saved.</p>}
        <div className="um-actions">
          <button type="button" className="um-btn um-btn--primary" disabled={busy || working || !dirty} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="um-btn" disabled={busy || !dirty} onClick={discard}>Cancel changes</button>
        </div>
      </div>
    </>
  );
}
