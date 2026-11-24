// Static checks of the responsive layout in src/index.css. jsdom does not apply
// media queries, so these read the stylesheet; they guard the agreed behaviour
// (left-aligned menu and headings, full-width content on large screens) but are
// not a visual test. Check real widths in a browser too.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/index.css', 'utf8');

// the part of the stylesheet inside `@media (min-width: 900px) { ... }`
function desktop(): string {
  const start = css.indexOf('@media (min-width: 900px)');
  expect(start, 'desktop media query').toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('unbalanced media query');
}
const rule = (sheet: string, selector: string) => {
  const m = sheet.match(new RegExp(`(^|[\\s}])${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`));
  expect(m, `rule ${selector}`).toBeTruthy();
  return m![2];
};

describe('small screens (default)', () => {
  it('centres the header text, menu and hero', () => {
    expect(rule(css, '.site-header__text')).toMatch(/text-align:\s*center/);
    expect(rule(css, '.site-nav')).toMatch(/justify-content:\s*center/);
    expect(rule(css, '.hero')).toMatch(/text-align:\s*center/);
  });
  it('keeps the content in a narrow column', () => {
    expect(rule(css, '.page')).toMatch(/max-width:\s*700px/);
  });
});

describe('header (all sizes)', () => {
  it('puts the first seal at the far left and the second at the far right, both at the top', () => {
    const h = rule(css, '.site-header');
    expect(h).toMatch(/display:\s*flex/);
    expect(h).toMatch(/justify-content:\s*space-between/);
    expect(h).toMatch(/align-items:\s*flex-start/);
  });
  it('lets the centred text take the space between the seals, and keeps the seals from shrinking', () => {
    expect(rule(css, '.site-header__text')).toMatch(/flex:\s*1 1 0/);
    expect(rule(css, '.seal')).toMatch(/flex-shrink:\s*0/);
  });
  it('the title is smaller than before (19px / 28px) and a subtitle follows it', () => {
    expect(parseInt(rule(css, '.site-title').match(/font-size:\s*(\d+)px/)![1])).toBeLessThan(19);
    expect(parseInt(rule(desktop(), '.site-title').match(/font-size:\s*(\d+)px/)![1])).toBeLessThan(28);
    expect(rule(css, '.site-subtitle')).toMatch(/font-size/);
  });
});

describe('large screens (min-width 900px)', () => {
  const d = desktop();
  it('keeps the site title, subtitle and menu centred between the seals', () => {
    expect(d).not.toMatch(/\.site-header__text\s*\{[^}]*text-align:\s*left/);
    expect(d).not.toMatch(/\.site-(nav|menu|subnav)\s*\{[^}]*justify-content:\s*flex-start/);
    expect(rule(css, '.site-header__text')).toMatch(/text-align:\s*center/);
  });
  it('left-aligns the page heading', () => {
    expect(rule(d, '.hero')).toMatch(/text-align:\s*left/);
  });
  it('removes the width cap so content uses the whole browser width', () => {
    expect(rule(d, '.page')).toMatch(/max-width:\s*none/);
    expect(rule(d, '.page')).toMatch(/margin:\s*0\b/);
  });
  it('keeps running text (About) at a readable line length', () => {
    expect(rule(d, '.page--text')).toMatch(/max-width:\s*\d+ch/);
  });
  it('cards fill the width in as many columns as fit', () => {
    expect(rule(css, '.cards-grid')).toMatch(/repeat\(auto-fill,\s*minmax\(/);
  });
});
