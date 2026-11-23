// Static checks of firestore.rules and firestore.indexes.json against the code.
// There is no Firebase emulator in this project yet, so these catch the usual
// slips (a new collection with no rule, an open write, a query with no index)
// by reading the files. They do NOT prove the rules behave correctly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PHOTO_URL_PATTERN } from '../src/lib/photoUrl';

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
    expect([...used].sort()).toEqual(['admins', 'groups', 'parishes', 'services', 'settings', 'users']);
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
  it('the retired admins records are readable only by their owner or a superadmin, and nobody writes them', () => {
    const b = block('admins');
    expect(b).not.toMatch(/allow read: if true/);
    expect(b).toMatch(/request\.auth\.uid == uid/);
    expect(b).toMatch(/allow write: if false/);
  });
  it('user profiles: read by the owner or an admin, never public', () => {
    const b = block('users');
    expect(b).not.toMatch(/if true/);
    expect(b).toMatch(/allow read: if isSignedIn\(\) && \(request\.auth\.uid == uid \|\| isAdminUp\(\)\)/);
  });
  it('user profiles: a person creates only their own, as a plain user (or the old superadmin)', () => {
    expect(block('users')).toMatch(/allow create: if isSignedIn\(\) && request\.auth\.uid == uid && newProfileOk\(\)/);
    expect(rules).toMatch(/request\.resource\.data\.role == 'user'/);
    expect(rules).toMatch(/request\.resource\.data\.role == 'superadmin' && legacySuper\(\)/);
    expect(rules).toMatch(/request\.resource\.data\.role == 'user' && !legacySuper\(\)/);   // the old superadmin cannot create themselves as a user
    expect(rules).toMatch(/request\.resource\.data\.parishIds == \[\]/);
  });
  it('user profiles: a person cannot change their own role; role changes are for somebody else', () => {
    const b = block('users');
    expect(b).toMatch(/request\.auth\.uid == uid && selfEditOk\(\)/);
    expect(b).toMatch(/request\.auth\.uid != uid && roleChangeOk\(\)/);
    // the self-edit may touch these fields and nothing else
    expect(rules).toMatch(/hasOnly\(\['displayName', 'photoURL', 'email', 'providers', 'profileEdited', 'lastSignInAt'\]\)/);
    // how a person signs in is limited to google / password
    expect(rules).toMatch(/hasOnly\(\['google', 'password'\]\)/);
    // a role change touches only role and parishIds
    expect(rules).toMatch(/hasOnly\(\['role', 'parishIds'\]\)/);
  });
  it('role changes: a superadmin anything; an admin only user/coordinator targets and never to superadmin', () => {
    const fn = rules.slice(rules.indexOf('function roleChangeOk'), rules.indexOf('match /users/'));
    expect(fn).toMatch(/isSuperAdmin\(\) \|\|/);
    expect(fn).toMatch(/resource\.data\.role in \['user', 'coordinator'\]/);
    expect(fn).toMatch(/request\.resource\.data\.role in \['user', 'coordinator', 'admin'\]/);
  });
  it('only a superadmin deletes profiles, and never their own', () => {
    expect(block('users')).toMatch(/allow delete: if isSuperAdmin\(\) && request\.auth\.uid != uid/);
  });
  it('services are written only for the parish the person may edit, on both old and new data', () => {
    const b = block('services');
    expect(b).toMatch(/allow read: if true/);
    expect(b).toMatch(/allow create: if request\.resource\.data\.parishId is string\s*&&\s*canEditParish\(request\.resource\.data\.parishId\)/);
    expect(b).toMatch(/allow update: if request\.resource\.data\.parishId is string\s*&&\s*canEditParish\(resource\.data\.parishId\)\s*&&\s*canEditParish\(request\.resource\.data\.parishId\)/);
    expect(b).toMatch(/allow delete: if canEditParish\(resource\.data\.parishId\)/);
  });
  it('a coordinator is limited to the parishes listed on their profile; admins edit all', () => {
    const fn = rules.slice(rules.indexOf('function canEditParish'), rules.indexOf('// Public read'));
    expect(fn).toMatch(/isAdminUp\(\)/);
    expect(fn).toMatch(/isCoordinator\(\)/);
    expect(fn).toMatch(/parishId in get\(myProfile\(\)\)\.data\.parishIds/);
  });
  it('the old superadmin record counts only while the person has no profile yet', () => {
    expect(rules).toMatch(/\(!hasProfile\(\) && legacySuper\(\)\)/);
  });
  it('uses the same role names as the app', () => {
    const roles = readFileSync('src/lib/roles.ts', 'utf8');
    ['user', 'coordinator', 'admin', 'superadmin'].forEach(r => {
      expect(rules).toContain(`'${r}'`);
      expect(roles).toContain(`'${r}'`);
    });
    expect(rules).not.toContain('parish-admin');
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

  it('photo addresses are limited to Google pictures and our Firebase Storage, on create and when changed', () => {
    expect(rules).toContain(PHOTO_URL_PATTERN);               // the same pattern as src/lib/photoUrl.ts
    expect(rules).toMatch(/&& photoUrlOk\(\) && providersOk\(\)\s*\n\s*&& request\.resource\.data\.parishIds == \[\]/);
    expect(rules).toMatch(/!newKeys\(\)\.hasAny\(\['photoURL'\]\) \|\| photoUrlOk\(\)/);
  });
  it('profileEdited can only be set to true by the person themselves, never on create', () => {
    expect(rules).toMatch(/!newKeys\(\)\.hasAny\(\['profileEdited'\]\) \|\| request\.resource\.data\.profileEdited == true/);
    const create = rules.slice(rules.indexOf('function newProfileOk'), rules.indexOf('function selfEditOk'));
    expect(create).not.toContain('profileEdited');
  });
});

describe('storage.rules', () => {
  const storage = readFileSync('storage.rules', 'utf8');
  it('only avatars/<uid>/<file> is open for anything; everything else is denied by default', () => {
    expect(storage).toMatch(/match \/avatars\/\{uid\}\/\{file\}/);
    expect(storage).not.toMatch(/allPaths/);
    expect(storage).not.toMatch(/if true/);
  });
  it('a person writes and deletes only in their own folder; uploads are a JPEG under 3 MB', () => {
    expect(storage).toMatch(/allow create, update: if request\.auth != null && request\.auth\.uid == uid/);
    expect(storage).toMatch(/request\.resource\.size < 3 \* 1024 \* 1024/);
    expect(storage).toMatch(/request\.resource\.contentType == 'image\/jpeg'/);
    expect(storage).toMatch(/allow delete: if request\.auth != null && request\.auth\.uid == uid/);
  });
  it('reading needs a signed-in person', () => {
    expect(storage).toMatch(/allow read: if request\.auth != null/);
  });
});
