// src/admin/TranslateBar.tsx
// Two buttons that translate one English/Greek pair of boxes into each other with Gemini. The result is
// put into the other box for the person to read and fix; nothing is saved by this.

import { useState } from 'react';
import { translateText, translateFailure } from './translate';
import type { TranslateFrom } from './translate';

interface Props {
  en: string;
  el: string;
  maxEn: number;
  maxEl: number;
  /** Puts text into a box. Called after the answer arrives, so it must not rely on values from an earlier render. */
  setEn(text: string): void;
  setEl(text: string): void;
  /** What is being translated, for the button text ("name", "schedule"); omit for the main text. */
  what?: string;
}

export default function TranslateBar({ en, el, maxEn, maxEl, setEn, setEl, what }: Props) {
  const [busy, setBusy] = useState<TranslateFrom | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function run(from: TranslateFrom) {
    const source = from === 'en' ? en : el;
    const target = from === 'en' ? el : en;
    const targetName = from === 'en' ? 'Greek' : 'English';
    if (target.trim() && !window.confirm(`Replace the ${targetName} text with a translation?`)) return;
    setBusy(from); setError(''); setDone(false);
    try {
      const out = await translateText(source, from);
      if (out.length > (from === 'en' ? maxEl : maxEn)) {
        setError(`The translation is longer than the ${targetName} box allows (${from === 'en' ? maxEl : maxEn} characters). Shorten the text and try again.`);
        return;
      }
      (from === 'en' ? setEl : setEn)(out);
      setDone(true);
    } catch (e) { setError(translateFailure(e)); } finally { setBusy(null); }
  }

  const label = (from: TranslateFrom) => {
    const w = what ? `${what} ` : '';
    return busy === from ? 'Translating…' : from === 'en' ? `Translate ${w}English → Greek` : `Translate ${w}Greek → English`;
  };

  return (
    <div className="ed-translate">
      <button type="button" className="um-btn" disabled={busy !== null || !en.trim()} onClick={() => run('en')}>{label('en')}</button>
      <button type="button" className="um-btn" disabled={busy !== null || !el.trim()} onClick={() => run('el')}>{label('el')}</button>
      {done && <span role="status" className="um-muted">✓ Translated. Please read it through before saving.</span>}
      {error && <p role="alert" className="um-error">{error}</p>}
    </div>
  );
}
