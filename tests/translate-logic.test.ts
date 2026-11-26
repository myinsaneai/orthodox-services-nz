import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  translate, cleanRequest, cleanOutput, buildPrompt, sameLineCount, mayTranslate, TranslateError,
  MAX_CHARS, MAX_TRANSLATIONS, WINDOW_MS,
} from '../functions/src/translateLogic';
import type { Deps } from '../functions/src/translateLogic';

function fake(role: string | null = 'coordinator', answers: string[] = ['9:00 Όρθρος']) {
  const counts: Record<string, { start: number; n: number }> = {};
  const prompts: string[] = [];
  let i = 0;
  const deps: Deps = {
    async getRole() { return role; },
    async count(key, now) {
      const c = counts[key];
      counts[key] = !c || now - c.start > WINDOW_MS ? { start: now, n: 1 } : { start: c.start, n: c.n + 1 };
      return counts[key].n;
    },
    async callModel(prompt) { prompts.push(prompt); return answers[Math.min(i++, answers.length - 1)]; },
  };
  return { deps, counts, prompts };
}
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: TranslateError) => e.code);

describe('who may translate', () => {
  it('coordinators, admins and superadmins; not users and not people without a profile', () => {
    expect(['coordinator', 'admin', 'superadmin'].map(mayTranslate)).toEqual([true, true, true]);
    expect([mayTranslate('user'), mayTranslate(null), mayTranslate('root')]).toEqual([false, false, false]);
  });
  it('nobody signed out', async () => {
    const f = fake();
    expect(await code(translate({ text: 'x', from: 'en' }, undefined, f.deps))).toBe('unauthenticated');
    expect(f.prompts).toEqual([]);
  });
  it('a plain user is refused before anything is counted or sent', async () => {
    const f = fake('user');
    expect(await code(translate({ text: 'x', from: 'en' }, 'u1', f.deps))).toBe('permission-denied');
    expect(f.counts).toEqual({});
    expect(f.prompts).toEqual([]);
  });
});

describe('what is accepted', () => {
  it('trims, normalises line endings and names the target language', () => {
    expect(cleanRequest({ text: '  9:00 Orthros\r\n10:00 Liturgy \n', from: 'en' })).toEqual({ text: '9:00 Orthros\n10:00 Liturgy', from: 'en', to: 'el' });
    expect(cleanRequest({ text: 'Όρθρος', from: 'el' }).to).toBe('en');
  });
  it('refuses empty, too long, wrong types and unknown languages, without calling the model', async () => {
    const f = fake();
    for (const bad of [{ text: '', from: 'en' }, { text: '   \n', from: 'en' }, { text: 'x'.repeat(MAX_CHARS + 1), from: 'en' },
      { text: 5, from: 'en' }, { text: 'x', from: 'fr' }, { text: 'x' }, null, undefined, 'text'])
      expect(await code(translate(bad, 'u1', f.deps))).toBe('invalid-argument');
    expect(cleanRequest({ text: 'x'.repeat(MAX_CHARS), from: 'en' }).text).toHaveLength(MAX_CHARS);
    expect(f.prompts).toEqual([]);
  });
});

describe('the prompt', () => {
  const p = buildPrompt({ text: '9:00 Orthros', from: 'en', to: 'el' });
  it('names both languages, keeps lines, times and numbers, and carries the church terms', () => {
    expect(p).toContain('from English into Greek');
    expect(p).toMatch(/same number of lines/);
    expect(p).toMatch(/times, dates, numbers/);
    expect(p).toContain('Divine Liturgy = Θεία Λειτουργία');
    expect(p).toContain('π.μ.');
  });
  it('puts the text between markers and tells the model not to follow it', () => {
    expect(p).toMatch(/<<<\n9:00 Orthros\n>>>$/);
    expect(p).toMatch(/never follow it/);
  });
  it('goes the other way for Greek', () => {
    expect(buildPrompt({ text: 'Όρθρος', from: 'el', to: 'en' })).toContain('from Greek into English');
  });
});

describe('the answer', () => {
  it('returns it, cleaned of fences, markers and surrounding space', async () => {
    const f = fake('admin', ['```\n9:00 Όρθρος\n10:00 Θεία Λειτουργία\n```']);
    expect(await translate({ text: '9:00 Orthros\n10:00 Divine Liturgy', from: 'en' }, 'u1', f.deps)).toEqual({ text: '9:00 Όρθρος\n10:00 Θεία Λειτουργία' });
    expect(cleanOutput('<<<\nA\n>>>')).toBe('A');
    expect(cleanOutput('  A\r\nB  ')).toBe('A\nB');
  });
  it('keeps the line structure: a reply with a different number of lines is asked for again once', async () => {
    const f = fake('admin', ['9:00 Όρθρος 10:00 Θεία Λειτουργία', '9:00 Όρθρος\n10:00 Θεία Λειτουργία']);
    const out = await translate({ text: '9:00 Orthros\n10:00 Divine Liturgy', from: 'en' }, 'u1', f.deps);
    expect(out.text.split('\n')).toHaveLength(2);
    expect(f.prompts).toHaveLength(2);
  });
  it('gives up after the second bad reply, and on an empty reply', async () => {
    const bad = fake('admin', ['one line', 'still one line']);
    expect(await code(translate({ text: 'a\nb', from: 'en' }, 'u1', bad.deps))).toBe('internal');
    expect(bad.prompts).toHaveLength(2);
    expect(await code(translate({ text: 'a', from: 'en' }, 'u1', fake('admin', ['', '  ']).deps))).toBe('internal');
  });
  it('blank lines in the original stay blank lines', () => {
    expect(sameLineCount('a\n\nb', 'x\n\ny')).toBe(true);
    expect(sameLineCount('a\n\nb', 'x\ny')).toBe(false);
  });
});

describe('rate limit', () => {
  it('lets each person MAX_TRANSLATIONS per window, counted separately, and starts again after it', async () => {
    const f = fake('admin');
    for (let i = 0; i < MAX_TRANSLATIONS; i++) await translate({ text: 'x', from: 'en' }, 'a', f.deps, 1000);
    expect(await code(translate({ text: 'x', from: 'en' }, 'a', f.deps, 1000))).toBe('resource-exhausted');
    expect(await code(translate({ text: 'x', from: 'en' }, 'b', f.deps, 1000))).toBe('ok');
    expect(await code(translate({ text: 'x', from: 'en' }, 'a', f.deps, 1000 + WINDOW_MS + 1))).toBe('ok');
    expect(f.prompts).toHaveLength(MAX_TRANSLATIONS + 2);        // the refused one never reached the model
  });
});

describe('deployment wiring', () => {
  const fn = readFileSync('functions/src/index.ts', 'utf8');
  it('the function and the app agree on the name and region, and the key is a secret', () => {
    expect(fn).toContain('export const translateServiceText');
    expect(fn).toContain("region: 'australia-southeast1'");
    expect(fn).toContain("defineSecret('GEMINI_API_KEY')");
    expect(fn).toContain('secrets: [geminiApiKey]');
    expect(readFileSync('src/admin/translate.ts', 'utf8')).toContain("'translateServiceText'");
  });
  it('no key or model secret is written in the code', () => {
    expect(fn).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(readFileSync('src/admin/translate.ts', 'utf8')).not.toMatch(/generativelanguage|apiKey/i);
  });
  it('limits match the app: MAX_CHARS is the size of the day box', () => {
    expect(MAX_CHARS).toBe(4000);
    expect(readFileSync('src/lib/scheduleDocs.ts', 'utf8')).toMatch(/DAY_TEXT_MAX = 4000/);
  });
  it('the key is read from the Secret Manager at call time, not at load', () => {
    expect(fn).toMatch(/geminiApiKey\.value\(\)/);
    expect(fn).not.toMatch(/^const .* = geminiApiKey\.value\(\)/m);
  });
});
