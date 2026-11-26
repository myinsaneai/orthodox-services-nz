import { describe, it, expect } from 'vitest';
import { t } from '../src/lib/i18n';
import type { StringKey } from '../src/lib/i18n';
import { readFileSync } from 'node:fs';

// Every key used in the table, read from the source so a new key is covered automatically.
const src = readFileSync('src/lib/i18n.ts', 'utf8');
const keys = [...src.matchAll(/^\s{2}(\w+):\s*\{ en:/gm)].map(m => m[1]) as StringKey[];

describe('UI strings', () => {
  it('finds the keys', () => {
    expect(keys.length).toBeGreaterThanOrEqual(10);
    expect(keys).toContain('navServices');
  });
  it('every key has a non-empty English and Greek text', () => {
    keys.forEach(k => {
      expect(t(k, 'en').trim(), `${k} en`).not.toBe('');
      expect(t(k, 'el').trim(), `${k} el`).not.toBe('');
    });
  });
  it('the Greek text is really Greek and the English is not', () => {
    const greek = /[Ͱ-Ͽἀ-῿]/;
    keys.forEach(k => {
      expect(greek.test(t(k, 'el')), `${k} el`).toBe(true);
      expect(greek.test(t(k, 'en')), `${k} en`).toBe(false);
    });
  });
  it('has exactly the three agreed menu items', () => {
    expect(t('navServices', 'en')).toBe('Calendar');
    expect(t('navParishes', 'en')).toBe('Parishes');
    expect(t('navAbout', 'en')).toBe('About');
  });
});
