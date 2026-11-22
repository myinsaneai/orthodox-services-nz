// src/pages/ParishesPage.tsx
// Directory of parishes; each links to its own schedule view.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import { subscribeParishes } from '../lib/firestore';
import type { Parish } from '../lib/firestore';
import { DEFAULT_PARISH_ACCENT } from '../themes/tokens';

export default function ParishesPage() {
  const { lang } = useLang();
  const [parishes, setParishes] = useState<Parish[]>([]);

  useEffect(() => subscribeParishes(setParishes), []);

  return (
    <>
      <div className="hero">
        <h1>{t('parishesHeading', lang)}</h1>
      </div>

      <div className="page cards-grid cards-grid--parishes">
        {parishes.filter(p => p.visible).map(p => (
          <Link
            key={p.id} to={`/services?parish=${encodeURIComponent(p.slug)}`}
            style={{
              display: 'block', textDecoration: 'none', padding: '12px 14px',
              border: '0.5px solid var(--color-card-border)', borderRadius: 8,
              background: 'var(--color-card-bg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: p.accentColor || DEFAULT_PARISH_ACCENT,
              }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{lang === 'el' ? p.nameEl : p.nameEn}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
              {p.city}{p.address ? ` · ${p.address}` : ''}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
