// src/pages/ParishesPage.tsx
// Directory of parishes; each links to its own schedule view.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import { subscribeParishes } from '../lib/firestore';
import type { Parish } from '../lib/firestore';
import { DEFAULT_PARISH_ACCENT } from '../themes/tokens';
import { useRoleHint } from '../hooks/useRoleHint';
import { isAtLeast } from '../lib/roles';
import { stateById } from '../lib/states';
import { safeMapUrl } from '../lib/mapUrl';
import { safePhotoUrl } from '../lib/photoUrl';

export default function ParishesPage() {
  const { lang } = useLang();
  const [parishes, setParishes] = useState<Parish[]>([]);

  useEffect(() => subscribeParishes(setParishes), []);
  // Admin buttons: shown from the stored role hint (display only; the Firestore rules decide who may write).
  const canManage = isAtLeast(useRoleHint(), 'admin');

  return (
    <>
      <div className="hero">
        <h1>{t('parishesHeading', lang)}</h1>
        {canManage && (
          <div className="hero-actions">
            <Link to="/admin/parishes/new" className="btn-add">{t('addParish', lang)}</Link>
          </div>
        )}
      </div>

      <div className="page cards-grid cards-grid--parishes">
        {parishes.filter(p => p.visible).map(p => {
          const el = lang === 'el';
          const city = (el && p.cityEl) || p.city;
          const st = stateById(p.state);
          const where = [city, st && (el ? st.nameEl : st.nameEn)].filter(Boolean).join(' · ');
          const description = (el ? p.descriptionEl : p.descriptionEn) || '';
          const map = safeMapUrl(p.mapUrl);
          return (
            <div key={p.id} style={{
              padding: '12px 14px', border: '0.5px solid var(--color-card-border)',
              borderRadius: 8, background: 'var(--color-card-bg)',
            }}>
              <Link to={`/services?parish=${encodeURIComponent(p.slug)}`} style={{ display: 'block', textDecoration: 'none' }}>
                {safePhotoUrl(p.photoURL) && <img className="pc-photo" src={safePhotoUrl(p.photoURL)} alt="" loading="lazy" />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: p.accentColor || DEFAULT_PARISH_ACCENT,
                  }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{el ? p.nameEl : p.nameEn}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{where}</div>
              </Link>
              {description && <div className="pc-desc">{description}</div>}
              {p.address && <div className="pc-addr">{p.address}</div>}
              {canManage && (
                <div><Link className="pc-edit" to={`/admin/parishes/${encodeURIComponent(p.id)}`}>{t('editParish', lang)}</Link></div>
              )}
              {map && (
                <a className="pc-map" href={map} target="_blank" rel="noopener noreferrer">{t('viewMap', lang)}</a>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
