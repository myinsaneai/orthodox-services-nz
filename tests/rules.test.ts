// Static checks of firestore.rules and firestore.indexes.json against the code.
// There is no Firebase emulator in this project yet, so these catch the usual
// slips (a new collection with no rule, an open write, a query with no index)
// by reading the files. They do NOT prove the rules behave correctly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const rules = readFileSync('firestore.rules', 'utf8');
const code = readFileSync('src/lib/firestore.ts', 'utf8');
const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));

const used = new Set([...code.matchAll(/(?:collection|doc)\(db,\s*'(\w+)'/g)].map(m => m[1]));
const matched = new Set([...rules.matchAll(/match \/(\w+)\/\{/g)].map(m => m[1]));

// The body of one `match /name/{...} { ... }` block, from its header to the next block.
function block(name: string): string {
  const start = rules.search(new RegExp(`match /${name}/\\{`));
  expect(start, `rule block for ${name}`).toBeGreaterThanOrEqual(0);
  const rest = rules.slice(start + 1);
  const next = rest.search(/\n\s*match \//);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('firestore.rules', () => {
  it('the code uses the expected collections', () => {
    expect([...used].sort()).toEqual(['admins', 'groups', 'parishes', 'services', 'settings']);
  });
  it('every collection the code touches has a rule block', () => {
    used.forEach(c => expect(matched.has(c), `no rule for "${c}"`).toBe(true));
  });
  it('no rule block opens writes to everyone', () => {
    expect(rules).not.toMatch(/allow\s+(write|create|update|delete)[^;]*:\s*if\s+true/);
    expect(rules).not.toMatch(/match \/\{document=\*\*\}/);
  });
  it('parishes, groups and settings are readable by all but written only by a superadmin', () => {
    ['parishes', 'groups', 'settings'].forEach(c => {
      const b = block(c);
      expect(b, c).toMatch(/allow read: if true/);
      expect(b, c).toMatch(/allow write: if isSuperAdmin\(\)/);
    });
  });
  it('admin records are never publicly readable and only a superadmin writes them', () => {
    const b = block('admins');
    expect(b).not.toMatch(/allow read: if true/);
    expect(b).toMatch(/request\.auth\.uid == uid/);
    expect(b).toMatch(/allow write: if isSuperAdmin\(\)/);
  });
  it('services are written only for the parish the person may edit, on both old and new data', () => {
    const b = block('services');
    expect(b).toMatch(/allow read: if true/);
    expect(b).toMatch(/allow create: if canEditParish\(request\.resource\.data\.parishId\)/);
    expect(b).toMatch(/allow update: if canEditParish\(resource\.data\.parishId\)\s*&&\s*canEditParish\(request\.resource\.data\.parishId\)/);
    expect(b).toMatch(/allow delete: if canEditParish\(resource\.data\.parishId\)/);
  });
  it('a parish-admin is limited to the parishes listed on their admin record', () => {
    expect(rules).toMatch(/role == 'parish-admin'/);
    expect(rules).toMatch(/parishId in adminDoc\(\)\.parishIds/);
  });
  it('uses the same role names as the app', () => {
    const ctx = readFileSync('src/contexts/AuthContext.tsx', 'utf8');
    ['superadmin', 'parish-admin'].forEach(r => {
      expect(rules).toContain(`'${r}'`);
      expect(ctx).toContain(`'${r}'`);
    });
  });
});

describe('firestore.indexes.json', () => {
  type Idx = { collectionGroup: string; fields: { fieldPath: string; order: string }[] };
  const has = (fields: string[]) =>
    (indexes.indexes as Idx[]).some(i =>
      i.collectionGroup === 'services' &&
      i.fields.map(f => f.fieldPath).join(',') === fields.join(',') &&
      i.fields.every(f => f.order === 'ASCENDING'));

  it('has the index for "all parishes" (date range ordered by date, time)', () => {
    expect(has(['date', 'time'])).toBe(true);
  });
  it('has the index for one parish or a group (parishId in [...] + date range)', () => {
    expect(has(['parishId', 'date', 'time'])).toBe(true);
  });
  it('matches the queries in the code', () => {
    expect(code).toMatch(/where\('date', '>=', fromDate\), orderBy\('date'\), orderBy\('time'\)/);
    expect(code).toMatch(/where\('parishId', 'in', scope\.slice\(0, IN_LIMIT\)\)/);
  });
});
