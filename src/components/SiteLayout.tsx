// src/components/SiteLayout.tsx
// Public shell — Option A "Cathedral Classic": maroon header with the two
// seals flanking the site title, nav row (Services / Parishes / About + language).

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import type { StringKey } from '../lib/i18n';
import LangToggle from './LangToggle';
import sealLeft from '../assets/seals/seal-left-ecumenical-patriarchate.png';
import sealRight from '../assets/seals/seal-right-holy-metropolis-nz.png';

const NAV: { to: string; key: StringKey }[] = [
  { to: '/services', key: 'navServices' },
  { to: '/parishes', key: 'navParishes' },
  { to: '/about',    key: 'navAbout' },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--color-primary)', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <img className="seal" src={sealLeft} alt="Ecumenical Patriarchate" />
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19,
            color: 'var(--color-accent-lt)', letterSpacing: 0.5,
          }}>
            {t('siteTitle', lang)}
          </div>
          <nav aria-label="Main navigation" style={{
            display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'center',
            marginTop: 6, fontSize: 12,
          }}>
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  color: 'var(--color-nav)', textDecoration: 'none', paddingBottom: 2,
                  borderBottom: isActive ? '1px solid var(--color-nav)' : '1px solid transparent',
                })}
              >
                {t(item.key, lang)}
              </NavLink>
            ))}
            <LangToggle />
          </nav>
        </div>
        <img className="seal" src={sealRight} alt="Holy Metropolis of New Zealand" />
      </header>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
