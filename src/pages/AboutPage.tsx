// src/pages/AboutPage.tsx
// Placeholder — content to be supplied.

import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';

export default function AboutPage() {
  const { lang } = useLang();
  return (
    <>
      <div style={{ background: 'var(--color-cream)', padding: '20px 24px 18px', textAlign: 'center' }}>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26,
          color: 'var(--color-accent)',
        }}>
          {t('aboutHeading', lang)}
        </h1>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px 40px', color: 'var(--color-muted)' }}>
        <p>About content coming soon.</p>
      </div>
    </>
  );
}
