// src/admin/DayEditor.tsx
// The form for one parish's schedule on one day: two text boxes (English and Greek, one service per
// line), buttons that fill them from a saved full-day template or add a saved single line, and
// Save / Clear. It lives inside the day panel of the calendar on the schedule editor page.

import { useState } from 'react';
import { saveServiceDay, deleteServiceDay } from '../lib/firestore';
import type { Parish, ServiceDay, ServiceTemplate, ServiceEntryType } from '../lib/firestore';
import { appendLine, cleanText, DAY_TEXT_MAX } from '../lib/scheduleDocs';

interface Props {
  parish: Parish;
  date: string;
  day: ServiceDay | undefined;             // what is saved now, if anything
  templates: ServiceTemplate[];
  entryTypes: ServiceEntryType[];
  libraryFailed: boolean;                  // templates / quick entries could not be loaded
}

const failure = (err: unknown) =>
  (err as { code?: string })?.code === 'permission-denied'
    ? "You are not allowed to change this parish's schedule. Your role may have changed; reload the page and try again."
    : 'The schedule could not be saved. Check your connection and try again.';

export default function DayEditor({ parish, date, day, templates, entryTypes, libraryFailed }: Props) {
  const [en, setEn] = useState(day?.entriesEn ?? '');
  const [el, setEl] = useState(day?.entriesEl ?? '');
  // What is saved (as last loaded or last saved), to tell whether there is anything to save.
  const [base, setBase] = useState({ en: cleanText(day?.entriesEn ?? ''), el: cleanText(day?.entriesEl ?? '') });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const dirty = cleanText(en) !== base.en || cleanText(el) !== base.el;
  const hasSaved = base.en !== '' || base.el !== '';

  const edit = (en2: string, el2: string) => { setEn(en2); setEl(el2); setSaved(false); setError(''); };

  async function save() {
    setBusy(true); setError('');
    try {
      await saveServiceDay(parish.id, date, en, el);
      setBase({ en: cleanText(en), el: cleanText(el) });
      setSaved(true);
    } catch (e) { setError(failure(e)); } finally { setBusy(false); }
  }

  async function clearDay() {
    if (!window.confirm('Remove the schedule of this parish for this day?')) return;
    setBusy(true); setError('');
    try {
      await deleteServiceDay(parish.id, date);
      setEn(''); setEl(''); setBase({ en: '', el: '' }); setSaved(false);
    } catch (e) { setError(failure(e)); } finally { setBusy(false); }
  }

  return (
    <div className="ed-day">
      <p className="ed-who">{parish.nameEn}</p>

      {libraryFailed && <p role="alert" className="um-error">Templates and quick entries could not be loaded.</p>}

      {templates.length > 0 && (
        <div className="ed-box">
          <div className="ed-box__title">Apply a full-day template (replaces the text below)</div>
          <div className="ed-chips">
            {templates.map(t => (
              <button key={t.id} type="button" className="um-btn" title={t.nameEl}
                      onClick={() => edit(t.entriesEn, t.entriesEl)}>
                {t.nameEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {entryTypes.length > 0 && (
        <div className="ed-box ed-box--add">
          <div className="ed-box__title">Add a single entry</div>
          <div className="ed-chips">
            {entryTypes.map(e => (
              <button key={e.id} type="button" className="um-btn" title={e.textEl}
                      onClick={() => edit(appendLine(en, e.textEn), appendLine(el, e.textEl))}>
                + {e.textEn}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ed-cols">
        <label className="pf-field">
          <span>English</span>
          <textarea rows={7} value={en} maxLength={DAY_TEXT_MAX} lang="en"
                    placeholder={'9:00 Orthros\n10:00 Divine Liturgy'}
                    onChange={e => edit(e.target.value, el)} />
        </label>
        <label className="pf-field">
          <span>Ελληνικά (Greek)</span>
          <textarea rows={7} value={el} maxLength={DAY_TEXT_MAX} lang="el"
                    placeholder={'9:00 Όρθρος\n10:00 Θεία Λειτουργία'}
                    onChange={e => edit(en, e.target.value)} />
        </label>
      </div>
      <p className="um-muted">
        One service per line; times such as 9:30 are shown in bold. If one language is left empty, visitors
        see the other one.
      </p>

      {error && <p role="alert" className="um-error">{error}</p>}
      <div className="um-actions">
        <button type="button" className="um-btn um-btn--primary" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Saving…' : 'Save & publish'}
        </button>
        {hasSaved && (
          <button type="button" className="um-btn um-btn--danger" disabled={busy} onClick={clearDay}>Clear day</button>
        )}
        {saved && !dirty && <span role="status" className="um-muted">✓ Saved and live</span>}
      </div>
    </div>
  );
}
