import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkEmail, cleanEmail, publicProviders, CheckError, MAX_CHECKS, WINDOW_MS } from '../functions/src/checkEmailLogic';
import type { Deps } from '../functions/src/checkEmailLogic';

const accounts: Record<string, string[]> = {
  'maria@example.com': ['password'], 'nick@example.com': ['google.com'], 'both@example.com': ['password', 'google.com', 'facebook.com'],
};
function fake(): Deps & { counts: Record<string, { start: number; n: number }>; lookedUp: string[] } {
  const counts: Record<string, { start: number; n: number }> = {};
  const lookedUp: string[] = [];
  return {
    counts, lookedUp,
    async lookup(email) { lookedUp.push(email); return accounts[email] ? { providers: accounts[email] } : null; },
    async count(key, now) {
      const c = counts[key];
      counts[key] = !c || now - c.start > WINDOW_MS ? { start: now, n: 1 } : { start: c.start, n: c.n + 1 };
      return counts[key].n;
    },
  };
}

describe('checkEmail function logic', () => {
  it('says yes with the sign-in methods for a known email, ignoring case and spaces', async () => {
    expect(await checkEmail('  Maria@Example.com ', 'k', fake())).toEqual({ exists: true, providers: ['password'] });
    expect(await checkEmail('nick@example.com', 'k', fake())).toEqual({ exists: true, providers: ['google'] });
  });
  it('says no for an unknown email, with no providers', async () => {
    expect(await checkEmail('who@example.com', 'k', fake())).toEqual({ exists: false, providers: [] });
  });
  it('only google and password ever leave the server', () => {
    expect(publicProviders(['password', 'google.com', 'facebook.com', 'phone'])).toEqual(['google', 'password']);
  });
  it('rejects things that are not an email, without a lookup', async () => {
    const d = fake();
    for (const bad of ['', 'nope', 'a b@c.com', '@x.com', 'a@', null, undefined, 42, 'x'.repeat(400) + '@a.com'])
      await expect(checkEmail(bad, 'k', d)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(d.lookedUp).toEqual([]);
    expect(() => cleanEmail('a@b.co')).not.toThrow();
  });
  it('limits each caller to MAX_CHECKS per window, and other callers are unaffected', async () => {
    const d = fake();
    for (let i = 0; i < MAX_CHECKS; i++) await checkEmail('maria@example.com', 'a', d, 1000);
    await expect(checkEmail('maria@example.com', 'a', d, 2000)).rejects.toBeInstanceOf(CheckError);
    await expect(checkEmail('maria@example.com', 'a', d, 2000)).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect((await checkEmail('maria@example.com', 'b', d, 2000)).exists).toBe(true);
  });
  it('a blocked caller makes no lookups, and the allowance returns after the window', async () => {
    const d = fake();
    for (let i = 0; i < MAX_CHECKS + 3; i++) await checkEmail('maria@example.com', 'a', d, 1000).catch(() => {});
    expect(d.lookedUp).toHaveLength(MAX_CHECKS);
    expect((await checkEmail('maria@example.com', 'a', d, 1000 + WINDOW_MS + 1)).exists).toBe(true);
  });
});

describe('deployment wiring', () => {
  it('the function and the app use the same region and name', () => {
    const fn = readFileSync('functions/src/index.ts', 'utf8');
    const app = readFileSync('src/lib/firebaseAdmin.ts', 'utf8');
    expect(fn).toContain("region: 'australia-southeast1'");
    expect(app).toContain("getFunctions(app, 'australia-southeast1')");
    expect(fn).toContain('export const checkEmailExists');
    expect(readFileSync('src/admin/emailCheck.ts', 'utf8')).toContain("'checkEmailExists'");
  });
  it('the rate-limit collection is closed to browsers (no rule opens it)', () => {
    expect(readFileSync('firestore.rules', 'utf8')).not.toContain('rateLimits');
  });
  it('firebase.json deploys the functions folder', () => {
    expect(JSON.parse(readFileSync('firebase.json', 'utf8')).functions[0].source).toBe('functions');
  });
});
