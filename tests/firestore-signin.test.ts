import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

// What happens, in order, when a public page writes: the sign-in is restored first, then the batch is sent.
const h = vi.hoisted(() => ({ log: [] as string[], ready: null as null | Promise<void> }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => `${col}/${id}`,
  writeBatch: () => ({
    update: (ref: string, data: unknown) => h.log.push(`update ${ref} ${JSON.stringify(data)}`),
    commit: async () => { h.log.push('commit'); },
  }),
}));
vi.mock('../src/lib/firebase', () => ({ db: {} }));
vi.mock('../src/lib/firebaseAdmin', () => ({
  auth: { authStateReady: () => { h.log.push('authStateReady called'); return h.ready ?? Promise.resolve(); } },
}));

import { setParishOrder } from '../src/lib/firestore';

beforeEach(() => { h.log = []; h.ready = null; });

describe('writing from a public page', () => {
  it('waits for the saved sign-in before it sends the reorder', async () => {
    let release!: () => void;
    h.ready = new Promise<void>(r => { release = () => { h.log.push('sign-in restored'); r(); }; });
    const done = setParishOrder([{ id: 'a', order: 2 }, { id: 'b', order: 1 }]);
    await new Promise(r => setTimeout(r, 20));
    expect(h.log).toEqual(['authStateReady called']);           // nothing written yet
    release();
    await done;
    expect(h.log).toEqual([
      'authStateReady called', 'sign-in restored',
      'update parishes/a {"order":2}', 'update parishes/b {"order":1}', 'commit',
    ]);
  });
  it('the public pages and firestore.ts never import the sign-in code statically', () => {
    const src = readFileSync('src/lib/firestore.ts', 'utf8');
    expect(src).not.toMatch(/^import .*firebaseAdmin/m);
    expect(src).not.toMatch(/from 'firebase\/auth'/);
    expect(src).toMatch(/await import\('\.\/firebaseAdmin'\)/);
  });
});
