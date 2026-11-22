// src/components/LangToggle.tsx

import { useLang } from '../contexts/LangContext';

export default function LangToggle() {
  const { lang, setLang } = useLang();
  const dim = (active: boolean) => ({ opacity: active ? 1 : 0.55, fontWeight: active ? 700 : 400 });

  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'el' : 'en')}
      aria-label={lang === 'en' ? 'Switch to Greek' : 'Switch to English'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: 'var(--font-body)', fontSize: 'inherit', color: 'var(--color-nav)',
        display: 'flex', gap: 4,
      }}
    >
      <span style={dim(lang === 'en')}>EN</span>
      <span style={{ opacity: 0.6 }}>|</span>
      <span style={dim(lang === 'el')}>ΕΛ</span>
    </button>
  );
}
