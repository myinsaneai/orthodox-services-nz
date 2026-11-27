// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../src/contexts/LangContext';
import SiteLayout from '../src/components/SiteLayout';

const mount = (path = '/services') => render(
  <MemoryRouter initialEntries={[path]}>
    <LangProvider><SiteLayout><p>page body</p></SiteLayout></LangProvider>
  </MemoryRouter>,
);
const setBrowserLang = (v: string) =>
  Object.defineProperty(navigator, 'language', { value: v, configurable: true });

beforeEach(() => { localStorage.clear(); setBrowserLang('en-NZ'); });
afterEach(() => { cleanup(); document.documentElement.lang = ''; });

describe('header', () => {
  it('shows the title and both seals flanking it', () => {
    mount();
    expect(screen.getByText('Holy Metropolis of New Zealand (Fiji, Tonga & Samoa)')).toBeTruthy();
    expect(screen.getByText('Sacred Services')).toBeTruthy();
    const left = screen.getByAltText('Ecumenical Patriarchate');
    const right = screen.getByAltText('Holy Metropolis of New Zealand');
    expect(left.getAttribute('src')).toBeTruthy();
    expect(right.getAttribute('src')).toBeTruthy();
    expect(left.getAttribute('src')).not.toBe(right.getAttribute('src'));
    // order in the header: seal, title, seal
    const header = screen.getByRole('banner');
    const order = [...header.querySelectorAll('img, div')].map(e => e.tagName === 'IMG' ? (e as HTMLImageElement).alt : '');
    expect(order.indexOf('Ecumenical Patriarchate')).toBeLessThan(order.indexOf('Holy Metropolis of New Zealand'));
  });
  it('has exactly Parishes, Calendar, About and the language switch, in that order', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map(a => a.textContent)).toEqual(['Parishes', 'Calendar', 'About']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/parishes', '/services', '/about']);
    expect(within(nav).getAllByRole('button')).toHaveLength(1);
  });
  it('underlines the current page', () => {
    mount('/parishes');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('Parishes').getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByText('Calendar').getAttribute('aria-current')).toBeNull();
  });
  it('uses the layout classes that the responsive CSS targets', () => {
    mount();
    const header = screen.getByRole('banner');
    expect(header.className).toBe('site-header');
    expect(header.querySelector('.site-title')?.textContent).toBe('Holy Metropolis of New Zealand (Fiji, Tonga & Samoa)');
    expect(header.querySelector('.site-subtitle')?.textContent).toBe('Sacred Services');
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).className).toBe('site-nav');
    expect(header.querySelectorAll('img.seal')).toHaveLength(2);
  });
  it('renders the page content', () => {
    mount();
    expect(screen.getByText('page body')).toBeTruthy();
  });
});

describe('language', () => {
  it('starts in English for an English browser and sets <html lang>', () => {
    mount();
    expect(document.documentElement.lang).toBe('en');
  });
  it('starts in Greek for a Greek browser when nothing is saved', () => {
    setBrowserLang('el-GR');
    mount();
    expect(screen.getByText('Ημερολόγιο')).toBeTruthy();
    expect(document.documentElement.lang).toBe('el');
  });
  it('switches to Greek, remembers it, and switches back', () => {
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Greek' }));
    expect(screen.getByText('Ημερολόγιο')).toBeTruthy();
    expect(screen.getByText('Ενορίες')).toBeTruthy();
    expect(screen.getByText('Σχετικά')).toBeTruthy();
    expect(document.documentElement.lang).toBe('el');
    expect(localStorage.getItem('gp_lang')).toBe('el');

    unmount();           // a new visit
    mount();
    expect(screen.getByText('Ημερολόγιο')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(localStorage.getItem('gp_lang')).toBe('en');
  });
  it('a saved choice beats the browser language', () => {
    setBrowserLang('el-GR');
    localStorage.setItem('gp_lang', 'en');
    mount();
    expect(screen.getByText('Calendar')).toBeTruthy();
  });
  it('ignores a junk saved value', () => {
    localStorage.setItem('gp_lang', 'fr');
    mount();
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('header title in Greek', () => {
  it('shows the Greek title and subtitle', () => {
    localStorage.setItem('gp_lang', 'el');
    mount();
    expect(screen.getByText('Ιερά Μητρόπολις Νέας Ζηλανδίας (Φίτζι, Τόνγκα και Σαμόα)')).toBeTruthy();
    expect(screen.getByText('Ιερές Ακολουθίες')).toBeTruthy();
  });
  it('puts the subtitle straight under the title, before the menu', () => {
    mount();
    const text = screen.getByRole('banner').querySelector('.site-header__text')!;
    expect([...text.children].slice(0, 3).map(e => e.className)).toEqual(['site-title', 'site-subtitle', 'site-menu']);
  });
});
