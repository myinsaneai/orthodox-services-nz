// src/pages/AboutPage.tsx
// Placeholder — content to be supplied.

import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';

export default function AboutPage() {
  const { lang } = useLang();
  return (
    <>
      <div className="hero">
        <h1>{t('aboutHeading', lang)}</h1>
      </div>
      <div className="page page--text" style={{ color: 'var(--color-muted)' }}>
        <p>About content coming soon.</p>
      </div>
    </>
  );
}
