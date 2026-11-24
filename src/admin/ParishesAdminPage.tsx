// src/admin/ParishesAdminPage.tsx
// My page → Parishes (admins): add a parish and see the ones that exist. Every text field has an
// English and a Greek version. The photo is optional: shrunk in the browser (longest side at most
// 1024 px), stored in Firebase Storage on Save, its address saved on the parish.

import { useEffect, useRef, useState } from 'react';
import { subscribeParishes, createParish } from '../lib/firestore';
import type { Parish } from '../lib/firestore';
import { PARISH_STATES, stateById } from '../lib/states';
import { checkImageFile, resizeImage } from '../lib/image';
import { emptyParishForm, checkParishForm, buildParish, LIMITS } from '../lib/parishes';
import type { ParishForm } from '../lib/parishes';
import AvatarDropzone from './AvatarDropzone';
import { uploadParishPhoto, removeParishPhoto } from './parishStorage';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function ParishesAdminPage() {
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<ParishForm>(emptyParishForm);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const [working, setWorking] = useState(false);     // shrinking the picture
  const [busy, setBusy] = useState(false);           // saving
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const urlRef = useRef('');

  useEffect(() => subscribeParishes(p => { setParishes(p); setLoaded(true); }), []);

  // Release the preview address when it is replaced and when leaving the page.
  useEffect(() => {
    const prev = urlRef.current;
    urlRef.current = photo?.url ?? '';
    if (prev && prev !== urlRef.current) URL.revokeObjectURL(prev);
  }, [photo]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const set = (k: keyof ParishForm) => (e: { target: { value: string } }) => {
    setForm(f => ({ ...f, [k]: e.target.value })); setDone('');
  };

  const pick = async (file: File) => {
    setDone('');
    const problem = checkImageFile(file);
    if (problem) { setError(problem); return; }
    setError(''); setWorking(true);
    try {
      const out = await resizeImage(file);
      setPhoto({ blob: out.blob, url: URL.createObjectURL(out.blob), width: out.width, height: out.height });
    } catch {
      setError('We could not read that picture. Please try a different one.');
    }
    setWorking(false);
  };

  const save = async () => {
    const problem = checkParishForm(form);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(''); setDone('');
    let uploaded = '';
    try {
      const parish = buildParish(form, '', parishes);
      if (photo) { uploaded = await uploadParishPhoto(parish.id, photo.blob); parish.photoURL = uploaded; }
      try {
        await createParish(parish);
      } catch (err) {
        if (uploaded) await removeParishPhoto(uploaded);       // do not leave a picture with no parish
        throw err;
      }
      setDone(`Parish "${parish.nameEn}" added.`);
      setForm(emptyParishForm()); setPhoto(null);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(code.startsWith('storage/')
        ? 'The photo could not be uploaded. Check your connection and try again.'
        : code === 'permission-denied'
          ? 'You are not allowed to add parishes.'
          : 'Could not save. Check your connection and try again.');
    }
    setBusy(false);
  };

  const text = (id: string, label: string, k: keyof ParishForm, max: number, lang?: string) => (
    <label className="pf-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="text" value={form[k]} maxLength={max} lang={lang} onChange={set(k)} />
    </label>
  );
  const area = (id: string, label: string, k: keyof ParishForm, lang: string) => (
    <label className="pf-field" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} rows={5} value={form[k]} maxLength={LIMITS.description} lang={lang} onChange={set(k)} />
    </label>
  );

  return (
    <>
      <div className="hero">
        <h1>Parishes</h1>
        <div className="hero-sub">Add a parish. Names, cities and descriptions are kept in English and Greek.</div>
      </div>
      <div className="page pa">
        <section className="pa-form" aria-labelledby="pa-new">
          <h2 id="pa-new">New parish</h2>

          <div className="pa-photo">
            {photo && <img className="pa-photo-img" src={photo.url} alt="Parish photo preview" />}
            <div className="pf-drop">
              <AvatarDropzone onFile={pick} disabled={busy || working} />
              {working && <p className="um-muted" role="status">Preparing the picture…</p>}
              {photo && !working && (
                <>
                  <p className="um-muted" role="status">
                    Photo ready: {photo.width} × {photo.height} px, {kb(photo.blob.size)}. It is saved with the parish.
                  </p>
                  <button type="button" className="um-btn" disabled={busy} onClick={() => setPhoto(null)}>Remove photo</button>
                </>
              )}
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
          {done && <p role="status" className="um-muted">{done}</p>}
          <div className="um-actions">
            <button type="button" className="um-btn um-btn--primary" disabled={busy || working} onClick={save}>
              {busy ? 'Saving…' : 'Add parish'}
            </button>
          </div>
        </section>

        <section aria-labelledby="pa-list">
          <h2 id="pa-list">Parishes ({parishes.length})</h2>
          {loaded && parishes.length === 0 && <p className="um-muted">No parishes yet.</p>}
          <ul className="pa-list">
            {parishes.map(p => (
              <li key={p.id}>
                {p.photoURL
                  ? <img className="pa-thumb" src={p.photoURL} alt="" />
                  : <span className="pa-thumb pa-thumb--empty" aria-hidden="true" />}
                <div>
                  <strong>{p.nameEn}</strong>
                  <span className="pa-sub">{p.nameEl}</span>
                  <span className="pa-sub">
                    {[p.city, stateById(p.state)?.nameEn].filter(Boolean).join(', ')}
                  </span>
                  {p.address && <span className="pa-sub pa-addr">{p.address}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
