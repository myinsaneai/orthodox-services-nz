// src/admin/ParishesAdminPage.tsx
// Add or edit a parish (admins), reached from the Parishes page: /admin/parishes/new and
// /admin/parishes/<id>. Every text field has an English and a Greek version. The photo is
// optional: shrunk in the browser (longest side at most 1024 px), stored in Firebase Storage
// on Save, its address saved on the parish. Editing also offers "Delete parish".

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { subscribeParishes, createParish, updateParish, deleteParishAndServices } from '../lib/firestore';
import type { Parish } from '../lib/firestore';
import { PARISH_STATES } from '../lib/states';
import { checkImageFile, resizeImage } from '../lib/image';
import { safePhotoUrl } from '../lib/photoUrl';
import { emptyParishForm, formFromParish, checkParishForm, buildParish, buildParishUpdate, LIMITS } from '../lib/parishes';
import type { ParishForm } from '../lib/parishes';
import AvatarDropzone from './AvatarDropzone';
import { uploadParishPhoto, removeParishPhoto, removeParishPhotos } from './parishStorage';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function ParishesAdminPage() {
  const { id } = useParams();                       // no id: a new parish
  const editing = !!id && id !== 'new';
  const navigate = useNavigate();
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edits, setEdits] = useState<Partial<ParishForm>>({});   // what the person has typed so far
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const [removed, setRemoved] = useState(false);     // editing: the current photo will be removed
  const [working, setWorking] = useState(false);     // shrinking the picture
  const [busy, setBusy] = useState(false);           // saving or deleting
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const urlRef = useRef('');

  useEffect(() => subscribeParishes(p => { setParishes(p); setLoaded(true); }), []);
  const current = editing ? parishes.find(p => p.id === id) : undefined;

  // The form is the parish being edited (or an empty form) with the person's typing on top.
  const form: ParishForm = { ...(current ? formFromParish(current) : emptyParishForm()), ...edits };

  // Release the preview address when it is replaced and when leaving the page.
  useEffect(() => {
    const prev = urlRef.current;
    urlRef.current = photo?.url ?? '';
    if (prev && prev !== urlRef.current) URL.revokeObjectURL(prev);
  }, [photo]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const set = (k: keyof ParishForm) => (e: { target: { value: string } }) => setEdits(x => ({ ...x, [k]: e.target.value }));

  const pick = async (file: File) => {
    const problem = checkImageFile(file);
    if (problem) { setError(problem); return; }
    setError(''); setWorking(true);
    try {
      const out = await resizeImage(file);
      setPhoto({ blob: out.blob, url: URL.createObjectURL(out.blob), width: out.width, height: out.height });
      setRemoved(false);
    } catch {
      setError('We could not read that picture. Please try a different one.');
    }
    setWorking(false);
  };

  const fail = (err: unknown) => {
    const code = (err as { code?: string })?.code ?? '';
    setError(code.startsWith('storage/')
      ? 'The photo could not be uploaded. Check your connection and try again.'
      : code === 'permission-denied'
        ? 'You are not allowed to do that.'
        : 'Could not save. Check your connection and try again.');
    setBusy(false);
  };

  const save = async () => {
    const problem = checkParishForm(form);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    let uploaded = '';
    try {
      const parish = editing && current ? buildParishUpdate(form, current.photoURL ?? '', current) : buildParish(form, '', parishes);
      if (photo) { uploaded = await uploadParishPhoto(parish.id, photo.blob); parish.photoURL = uploaded; }
      else if (removed) parish.photoURL = '';
      try {
        await (editing ? updateParish(parish) : createParish(parish));
      } catch (err) {
        if (uploaded) await removeParishPhoto(uploaded);       // do not leave a picture with no parish
        throw err;
      }
      if (editing && (photo || removed)) await removeParishPhotos(parish.id, parish.photoURL);   // tidy the old files
      navigate('/parishes');
    } catch (err) { fail(err); }
  };

  const remove = async () => {
    if (!current) return;
    setBusy(true); setError('');
    try {
      await deleteParishAndServices(current.id);
      await removeParishPhotos(current.id);
      navigate('/parishes');
    } catch (err) { fail(err); setConfirming(false); }
  };

  if (editing && loaded && !current) {
    return (
      <>
        <div className="hero"><h1>Parish not found</h1></div>
        <div className="page"><p>This parish no longer exists. <Link to="/parishes">Back to Parishes</Link></p></div>
      </>
    );
  }

  const shownPhoto = photo ? photo.url : removed ? '' : safePhotoUrl(current?.photoURL);

  const text = (fid: string, label: string, k: keyof ParishForm, max: number, lang?: string) => (
    <label className="pf-field" htmlFor={fid}>
      <span>{label}</span>
      <input id={fid} type="text" value={form[k]} maxLength={max} lang={lang} onChange={set(k)} />
    </label>
  );
  const area = (fid: string, label: string, k: keyof ParishForm, lang: string) => (
    <label className="pf-field" htmlFor={fid}>
      <span>{label}</span>
      <textarea id={fid} rows={5} value={form[k]} maxLength={LIMITS.description} lang={lang} onChange={set(k)} />
    </label>
  );

  return (
    <>
      <div className="hero">
        <h1>{editing ? 'Edit parish' : 'Add a parish'}</h1>
        <div className="hero-sub">Names, cities and descriptions are kept in English and Greek.</div>
      </div>
      <div className="page pa">
        <section className="pa-form">
          <div className="pa-photo">
            {shownPhoto && <img className="pa-photo-img" src={shownPhoto} alt="Parish photo" />}
            <div className="pf-drop">
              <AvatarDropzone onFile={pick} disabled={busy || working} />
              {working && <p className="um-muted" role="status">Preparing the picture…</p>}
              {photo && !working && (
                <p className="um-muted" role="status">
                  Photo ready: {photo.width} × {photo.height} px, {kb(photo.blob.size)}. It is saved with the parish.
                </p>
              )}
              {(photo || (editing && current?.photoURL && !removed)) && (
                <button type="button" className="um-btn" disabled={busy}
                        onClick={() => { setPhoto(null); setRemoved(true); }}>Remove photo</button>
              )}
              {removed && <p className="um-muted" role="status">The photo will be removed when you press Save.</p>}
              <p className="um-muted">The photo is optional.</p>
            </div>
          </div>

          <label className="pf-field" htmlFor="pa-state">
            <span>State</span>
            <select id="pa-state" value={form.state} onChange={set('state')}>
              {PARISH_STATES.map(s => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
            </select>
          </label>

          <div className="pa-cols">
            {text('pa-city-en', 'City (English)', 'cityEn', LIMITS.city, 'en')}
            {text('pa-city-el', 'City (Ελληνικά)', 'cityEl', LIMITS.city, 'el')}
            {text('pa-name-en', 'Parish name (English)', 'nameEn', LIMITS.name, 'en')}
            {text('pa-name-el', 'Parish name (Ελληνικά)', 'nameEl', LIMITS.name, 'el')}
            {area('pa-desc-en', 'Description (English), optional', 'descriptionEn', 'en')}
            {area('pa-desc-el', 'Description (Ελληνικά), optional', 'descriptionEl', 'el')}
          </div>

          <label className="pf-field" htmlFor="pa-address">
            <span>Address (the same for English and Greek)</span>
            <textarea id="pa-address" rows={3} value={form.address} maxLength={LIMITS.address} onChange={set('address')} />
          </label>

          <label className="pf-field" htmlFor="pa-map">
            <span>Location: Google Maps link, optional</span>
            <input id="pa-map" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={form.mapUrl}
                   onChange={set('mapUrl')} />
          </label>

          {error && <p role="alert" className="um-error">{error}</p>}
          <div className="um-actions">
            <button type="button" className="um-btn um-btn--primary" disabled={busy || working || (editing && !current)} onClick={save}>
              {busy && !confirming ? 'Saving…' : editing ? 'Save changes' : 'Add parish'}
            </button>
            <Link to="/parishes" className="um-btn" aria-disabled={busy}>Cancel</Link>
            {editing && current && !confirming && (
              <button type="button" className="um-btn um-btn--danger" disabled={busy} onClick={() => setConfirming(true)}>
                Delete parish
              </button>
            )}
          </div>

          {confirming && current && (
            <div className="um-confirm" role="alertdialog" aria-label="Confirm delete">
              <p>
                Delete <strong>{current.nameEn}</strong>? Its photo and <strong>all of its services</strong> are deleted
                too. This cannot be undone.
              </p>
              <div className="um-actions">
                <button type="button" className="um-btn um-btn--danger" disabled={busy} onClick={remove}>
                  {busy ? 'Deleting…' : 'Yes, delete this parish'}
                </button>
                <button type="button" className="um-btn" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
