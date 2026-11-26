// src/admin/TemplatesPage.tsx
// My page → Templates (admins). The two kinds of saved text that the schedule editor offers on every
// day: full-day templates (a whole day's schedule in both languages, e.g. "Sunday") and quick entries
// (one line in both languages, e.g. "9:00 Orthros"). Both lists are the same for every parish and can
// be reordered; the order here is the order of the buttons in the editor.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeServiceTemplates, subscribeServiceEntryTypes, saveServiceTemplate, saveServiceEntryType,
  deleteServiceTemplate, deleteServiceEntryType, setLibraryOrder, newLibraryId,
} from '../lib/firestore';
import type { ServiceTemplate, ServiceEntryType } from '../lib/firestore';
import TranslateBar from './TranslateBar';
import {
  DAY_TEXT_MAX, NAME_MAX, LINE_MAX, nextOrder, moveItem, templateComplete, entryTypeComplete,
} from '../lib/scheduleDocs';

interface Field<T> { key: keyof T & string; label: string; max: number; multiline?: boolean; required?: boolean; lang?: 'en' | 'el' }

/** Two boxes of the form that hold the same text in English and in Greek, and get a Translate bar under them. */
interface Pair<T> { en: keyof T & string; el: keyof T & string; what?: string }

interface SectionProps<T extends { id: string; order: number }> {
  title: string;
  hint: string;
  noun: string;                                  // "template" / "quick entry"
  plural: string;                                // "templates" / "quick entries"
  items: T[] | null;                             // null while loading
  failed: boolean;
  fields: Field<T>[];
  pairs: Pair<T>[];
  complete: (item: T) => boolean;
  primary: (item: T) => string;
  secondary: (item: T) => string;
  blank: () => Omit<T, 'id' | 'order'>;
  newId: () => string;
  onSave: (item: T) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOrder: (changed: T[]) => Promise<void>;
}

const failure = (err: unknown) =>
  (err as { code?: string })?.code === 'permission-denied'
    ? 'Not allowed. Your role may have changed; reload the page and try again.'
    : 'Could not save. Check your connection and try again.';

function LibrarySection<T extends { id: string; order: number }>(p: SectionProps<T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const [asking, setAsking] = useState<string | null>(null);     // id awaiting delete confirmation
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const items = p.items ?? [];

  async function run(fn: () => Promise<void>, after?: () => void) {
    setBusy(true); setError('');
    try { await fn(); after?.(); } catch (e) { setError(failure(e)); } finally { setBusy(false); }
  }

  return (
    <section>
      <h2 className="ed-h">{p.title}</h2>
      <p className="um-muted">{p.hint}</p>
      {p.failed && <p role="alert" className="um-error">The {p.plural} could not be loaded.</p>}
      {p.items === null && !p.failed && <p className="um-muted">Loading…</p>}
      {p.items && items.length === 0 && !draft && <p className="um-muted">No {p.plural} yet.</p>}

      <ul className="ed-list">
        {items.map((item, i) => (
          <li key={item.id}>
            <div className="ed-list__text">
              <strong>{p.primary(item)}</strong>
              <small>{p.secondary(item)}</small>
            </div>
            {asking === item.id ? (
              <div className="um-actions">
                <span className="um-muted">Delete “{p.primary(item)}”?</span>
                <button type="button" className="um-btn um-btn--danger" disabled={busy}
                        onClick={() => run(() => p.onDelete(item.id), () => setAsking(null))}>Yes, delete</button>
                <button type="button" className="um-btn" disabled={busy} onClick={() => setAsking(null)}>No</button>
              </div>
            ) : (
              <div className="um-actions">
                <button type="button" className="um-btn" aria-label={`Move ${p.primary(item)} up`} disabled={busy || i === 0}
                        onClick={() => run(() => p.onOrder(moveItem(items, i, -1)))}>↑</button>
                <button type="button" className="um-btn" aria-label={`Move ${p.primary(item)} down`} disabled={busy || i === items.length - 1}
                        onClick={() => run(() => p.onOrder(moveItem(items, i, 1)))}>↓</button>
                <button type="button" className="um-btn" aria-label={`Edit ${p.primary(item)}`} disabled={busy}
                        onClick={() => { setDraft({ ...item }); setError(''); setAsking(null); }}>Edit</button>
                <button type="button" className="um-btn um-btn--danger" aria-label={`Delete ${p.primary(item)}`} disabled={busy}
                        onClick={() => setAsking(item.id)}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {draft ? (
        <form className="ed-form" onSubmit={e => { e.preventDefault(); if (p.complete(draft)) run(() => p.onSave(draft), () => setDraft(null)); }}>
          {p.fields.map(f => {
            const pair = p.pairs.find(x => x.el === f.key);
            const maxOf = (key: string) => p.fields.find(x => x.key === key)?.max ?? 0;
            return (
              <div key={f.key}>
                <label className="pf-field">
                  <span>{f.label}</span>
                  {f.multiline ? (
                    <textarea rows={6} value={String(draft[f.key] ?? '')} maxLength={f.max} lang={f.lang}
                              onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
                  ) : (
                    <input type="text" value={String(draft[f.key] ?? '')} maxLength={f.max} lang={f.lang}
                           onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
                  )}
                </label>
                {pair && (
                  <TranslateBar
                    what={pair.what}
                    en={String(draft[pair.en] ?? '')} el={String(draft[pair.el] ?? '')}
                    maxEn={maxOf(pair.en)} maxEl={maxOf(pair.el)}
                    setEn={v => setDraft(d => (d ? { ...d, [pair.en]: v } : d))}
                    setEl={v => setDraft(d => (d ? { ...d, [pair.el]: v } : d))}
                  />
                )}
              </div>
            );
          })}
          {error && <p role="alert" className="um-error">{error}</p>}
          <div className="um-actions">
            <button type="submit" className="um-btn um-btn--primary" disabled={busy || !p.complete(draft)}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="um-btn" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {error && <p role="alert" className="um-error">{error}</p>}
          <button type="button" className="um-btn um-btn--primary" disabled={busy || p.items === null}
                  onClick={() => { setDraft({ ...p.blank(), id: p.newId(), order: nextOrder(items) } as T); setError(''); }}>
            Add {p.noun}
          </button>
        </>
      )}
    </section>
  );
}

const oneLine = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean).join(' · ');

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ServiceTemplate[] | null>(null);
  const [entryTypes, setEntryTypes] = useState<ServiceEntryType[] | null>(null);
  const [tplFailed, setTplFailed] = useState(false);
  const [etFailed, setEtFailed] = useState(false);

  useEffect(() => {
    const a = subscribeServiceTemplates(setTemplates, () => { setTplFailed(true); setTemplates([]); });
    const b = subscribeServiceEntryTypes(setEntryTypes, () => { setEtFailed(true); setEntryTypes([]); });
    return () => { a(); b(); };
  }, []);

  return (
    <>
      <div className="hero">
        <h1>Templates</h1>
        <div className="hero-sub">Saved schedules and lines for the schedule editor.</div>
      </div>
      <div className="page pa ed">
        <p><Link to="/admin/schedule">← Back to Schedule</Link></p>

        <LibrarySection<ServiceTemplate>
          title="Full-day templates"
          hint="A whole day's schedule in both languages, for example “Sunday” or “Great Feast”. Applying one in the editor replaces the day's text."
          noun="template" plural="templates"
          items={templates} failed={tplFailed}
          fields={[
            { key: 'nameEn', label: 'Name (English)', max: NAME_MAX, required: true, lang: 'en' },
            { key: 'nameEl', label: 'Όνομα (Ελληνικά)', max: NAME_MAX, required: true, lang: 'el' },
            { key: 'entriesEn', label: 'Schedule (English)', max: DAY_TEXT_MAX, multiline: true, lang: 'en' },
            { key: 'entriesEl', label: 'Πρόγραμμα (Ελληνικά)', max: DAY_TEXT_MAX, multiline: true, lang: 'el' },
          ]}
          pairs={[{ en: 'nameEn', el: 'nameEl', what: 'name' }, { en: 'entriesEn', el: 'entriesEl', what: 'schedule' }]}
          complete={templateComplete}
          primary={t => t.nameEn}
          secondary={t => oneLine(t.entriesEn) || '(no English text)'}
          blank={() => ({ nameEn: '', nameEl: '', entriesEn: '', entriesEl: '' })}
          newId={() => newLibraryId('serviceTemplates')}
          onSave={saveServiceTemplate}
          onDelete={deleteServiceTemplate}
          onOrder={changed => setLibraryOrder('serviceTemplates', changed)}
        />

        <LibrarySection<ServiceEntryType>
          title="Quick entries"
          hint="A single line in both languages, for example “9:00 Orthros”. The editor adds it to the end of the day with one click."
          noun="quick entry" plural="quick entries"
          items={entryTypes} failed={etFailed}
          fields={[
            { key: 'textEn', label: 'Line (English)', max: LINE_MAX, required: true, lang: 'en' },
            { key: 'textEl', label: 'Γραμμή (Ελληνικά)', max: LINE_MAX, required: true, lang: 'el' },
          ]}
          pairs={[{ en: 'textEn', el: 'textEl' }]}
          complete={entryTypeComplete}
          primary={e => e.textEn}
          secondary={e => e.textEl}
          blank={() => ({ textEn: '', textEl: '' })}
          newId={() => newLibraryId('serviceEntryTypes')}
          onSave={saveServiceEntryType}
          onDelete={deleteServiceEntryType}
          onOrder={changed => setLibraryOrder('serviceEntryTypes', changed)}
        />
      </div>
    </>
  );
}
