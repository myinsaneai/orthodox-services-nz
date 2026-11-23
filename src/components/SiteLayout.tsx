// src/components/SiteLayout.tsx
// Public shell — Option A "Cathedral Classic": maroon header with the two
// seals flanking the site title, nav row (Services / Parishes / About + language).

import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import { t } from '../lib/i18n';
import type { StringKey } from '../lib/i18n';
import LangToggle from './LangToggle';
import { useRoleHint } from '../hooks/useRoleHint';
import { setRoleHint } from '../lib/authHint';
import { isAtLeast } from '../lib/roles';
import type { RoleName } from '../lib/roles';
import sealLeft from '../assets/seals/seal-left-ecumenical-patriarchate.png';
import sealRight from '../assets/seals/seal-right-holy-metropolis-nz.png';

const NAV: { to: string; key: StringKey }[] = [
  { to: '/services', key: 'navServices' },
  { to: '/parishes', key: 'navParishes' },
  { to: '/about',    key: 'navAbout' },
];

// "My page" is in the menu for every signed-in person. Inside it, a second line shows the
// sections that person's role may open (Profile first); more are added here.
const MY_PAGE = { to: '/admin', key: 'navMyPage' as StringKey };
const MY_PAGE_SECTIONS: { to: string; key: StringKey; min: RoleName }[] = [
  { to: '/admin/profile', key: 'navProfile', min: 'user' },
  { to: '/admin/users',   key: 'navUsers',   min: 'admin' },
];

// Log in / Log out sits next to the menu, outside the <nav>, so the menu stays
// exactly Services, Parishes, About + language. It shows "Log out" from a
// stored hint written by the admin area; Firebase Auth itself is loaded only
// when "Log out" is clicked, never for ordinary visitors.
function AccountControl() {
  const { lang } = useLang();
  const signedIn = useRoleHint() !== null;
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return <Link className="site-account__btn" to="/admin/login">{t('logIn', lang)}</Link>;
  }
  const logOut = async () => {
    setBusy(true);
    try {
      const { adminSignOut } = await import('../admin/signOut');
      await adminSignOut();
    } catch {
      setRoleHint(null);            // could not reach Firebase: at least stop showing "Log out"
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="site-account__btn" onClick={logOut} disabled={busy}>
      {t('logOut', lang)}
    </button>
  );
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const { pathname } = useLocation();
  const role = useRoleHint();
  const hasMyPage = role !== null;
  const items = hasMyPage ? [...NAV, MY_PAGE] : NAV;
  const inMyPage = hasMyPage && (pathname === '/admin' || pathname.startsWith('/admin/'));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="site-header">
        <img className="seal" src={sealLeft} alt="Ecumenical Patriarchate" />
        <div className="site-header__text">
          <div className="site-title">{t('siteTitle', lang)}</div>
          <div className="site-menu">
          <nav aria-label="Main navigation" className="site-nav">
            {items.map(item => (
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
          <div className="site-account"><AccountControl /></div>
          </div>
          {inMyPage && (
            <nav aria-label="My page sections" className="site-subnav">
              {MY_PAGE_SECTIONS.filter(s => isAtLeast(role, s.min)).map(s => (
                <NavLink key={s.to} to={s.to} className="site-subnav__link">{t(s.key, lang)}</NavLink>
              ))}
            </nav>
          )}
        </div>
        <img className="seal" src={sealRight} alt="Holy Metropolis of New Zealand" />
      </header>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
