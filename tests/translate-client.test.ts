import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ calls: [] as any[], reply: null as any, error: null as any }));
vi.mock('firebase/functions', () => ({
  httpsCallable: (_f: unknown, name: string, opts: unknown) => async (payload: unknown) => {
    h.calls.push([name, payload, opts]);
    if (h.error) throw h.error;
    return { data: h.reply };
  },
}));
vi.mock('../src/lib/firebaseAdmin', () => ({ functions: { fake: true } }));

import { translateText, translateFailure } from '../src/admin/translate';

beforeEach(() => { h.calls = []; h.reply = { text: 'Όρθρος' }; h.error = null; });

describe('translateText', () => {
  it('calls the function with the text and the language to translate from, with a long enough timeout', async () => {
    expect(await translateText('Orthros', 'en')).toBe('Όρθρος');
    expect(h.calls).toEqual([['translateServiceText', { text: 'Orthros', from: 'en' }, { timeout: 130000 }]]);
  });
  it('treats an empty or odd answer as a failure', async () => {
    for (const r of [{ text: '' }, { text: '  ' }, {}, null, { text: 5 }]) {
      h.reply = r;
      await expect(translateText('x', 'en')).rejects.toThrow();
    }
  });
  it('passes the server error on', async () => {
    h.error = { code: 'functions/permission-denied' };
    await expect(translateText('x', 'el')).rejects.toMatchObject({ code: 'functions/permission-denied' });
  });
});

describe('translateFailure', () => {
  const msg = (code?: string) => translateFailure(code ? { code } : new Error('boom'));
  it('says something useful for each case the server can give', () => {
    expect(msg('functions/resource-exhausted')).toMatch(/Too many translations/);
    expect(msg('functions/permission-denied')).toMatch(/not allowed/);
    expect(msg('functions/unauthenticated')).toMatch(/sign in again/);
    expect(msg('functions/not-found')).toMatch(/not been deployed/);
    expect(msg('functions/deadline-exceeded')).toMatch(/busy or unreachable/);
    expect(msg('functions/unavailable')).toMatch(/busy or unreachable/);
    expect(msg('functions/internal')).toBe('The translation failed. Please try again.');
    expect(msg()).toBe('The translation failed. Please try again.');
  });
  it('shows the server\'s own sentence for a refused request', () => {
    expect(translateFailure(Object.assign(new Error('The text is longer than 4000 characters.'), { code: 'functions/invalid-argument' })))
      .toBe('The text is longer than 4000 characters.');
  });
});
