import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const svg = readFileSync('public/favicon.svg', 'utf8');

describe('favicon', () => {
  it('index.html links the SVG icon, an .ico fallback and the Apple touch icon, and every file exists', () => {
    const links = [...html.matchAll(/<link rel="([^"]*icon[^"]*)"[^>]*href="([^"]+)"/g)].map(m => [m[1], m[2]]);
    expect(links).toEqual([['icon', '/favicon.svg'], ['icon', '/favicon.ico'], ['apple-touch-icon', '/apple-touch-icon.png']]);
    for (const [, href] of links) expect(existsSync('public' + href), href).toBe(true);
  });
  it('the SVG is the IC XC NIKA cross: a square viewBox, two tones of maroon, no scripts or outside references', () => {
    expect(svg).toMatch(/^<svg [^>]*viewBox="52 52 920 920"/);
    expect(svg).toMatch(/fill="#5b0911"/);
    expect(svg).toMatch(/fill="#650f17"/);
    expect(svg).not.toMatch(/<script|<image|href=|url\(|<foreignObject|onload/i);
    expect(statSync('public/favicon.svg').size).toBeLessThan(20 * 1024);
  });
  it('the SVG gets a light background in dark mode, so the maroon stays visible on a dark tab', () => {
    expect(svg).toMatch(/prefers-color-scheme:\s*dark[^}]*\{[^}]*fill:\s*#f5efe6/);
  });
  it('the .ico holds 16, 32 and 48 px icons', () => {
    const ico = readFileSync('public/favicon.ico');
    expect(ico.readUInt16LE(0)).toBe(0);          // reserved
    expect(ico.readUInt16LE(2)).toBe(1);          // type: icon
    expect(ico.readUInt16LE(4)).toBe(3);          // three images
    const sizes = [0, 1, 2].map(i => ico[6 + i * 16] || 256);
    expect(sizes).toEqual([16, 32, 48]);
  });
  it('the Apple touch icon is a 180 x 180 PNG', () => {
    const png = readFileSync('public/apple-touch-icon.png');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  });
  it('the old Vite icon is gone', () => {
    expect(svg).not.toContain('863bff');
  });
});
