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
    expect(screen.getByText('Greek Orthodox Parishes of New Zealand')).toBeTruthy();
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
  it('has exactly Services, Parishes, About and the language switch', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map(a => a.textContent)).toEqual(['Services', 'Parishes', 'About']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/services', '/parishes', '/about']);
    expect(within(nav).getAllByRole('button')).toHaveLength(1);
  });
  it('underlines the current page', () => {
    mount('/parishes');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByText('Parishes').getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByText('Services').getAttribute('aria-current')).toBeNull();
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
    expect(screen.getByText('Ακολουθίες')).toBeTruthy();
    expect(document.documentElement.lang).toBe('el');
  });
  it('switches to Greek, remembers it, and switches back', () => {
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Greek' }));
    expect(screen.getByText('Ακολουθίες')).toBeTruthy();
    expect(screen.getByText('Ενορίες')).toBeTruthy();
    expect(screen.getByText('Σχετικά')).toBeTruthy();
    expect(document.documentElement.lang).toBe('el');
    expect(localStorage.getItem('gp_lang')).toBe('el');

    unmount();           // a new visit
    mount();
    expect(screen.getByText('Ακολουθίες')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByText('Services')).toBeTruthy();
    expect(localStorage.getItem('gp_lang')).toBe('en');
  });
  it('a saved choice beats the browser language', () => {
    setBrowserLang('el-GR');
    localStorage.setItem('gp_lang', 'en');
    mount();
    expect(screen.getByText('Services')).toBeTruthy();
  });
  it('ignores a junk saved value', () => {
    localStorage.setItem('gp_lang', 'fr');
    mount();
    expect(document.documentElement.lang).toBe('en');
  });
});
