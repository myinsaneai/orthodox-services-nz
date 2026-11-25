// Static checks of firestore.rules and firestore.indexes.json against the code.
// There is no Firebase emulator in this project yet, so these catch the usual
// slips (a new collection with no rule, an open write, a query with no index)
// by reading the files. They do NOT prove the rules behave correctly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PHOTO_URL_PATTERN } from '../src/lib/photoUrl';
import { MAP_URL_PATTERN } from '../src/lib/mapUrl';
import { DAY_TEXT_MAX, serviceDayId, serviceDayPayload, templatePayload, entryTypePayload } from '../src/lib/scheduleDocs';

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
    expect([...used].sort()).toEqual(['admins', 'groups', 'parishes', 'serviceDays', 'serviceEntryTypes', 'serviceTemplates', 'settings', 'users']);
  });
  it('every collection the code touches has a rule block', () => {
    used.forEach(c => expect(matched.has(c), `no rule for "${c}"`).toBe(true));
  });
  it('no rule block opens writes to everyone', () => {
    expect(rules).not.toMatch(/allow\s+(write|create|update|delete)[^;]*:\s*if\s+true/);
    expect(rules).not.toMatch(/match \/\{document=\*\*\}/);
  });
  it('groups and settings are readable by all but written only by a superadmin', () => {
    ['groups', 'settings'].forEach(c => {
      const b = block(c);
      expect(b, c).toMatch(/allow read: if true/);
      expect(b, c).toMatch(/allow write: if isSuperAdmin\(\)/);
    });
  });
  it('parishes: public read; an admin or superadmin may create, edit and delete (shape checked, slug never changes)', () => {
    const b = block('parishes');
    expect(b).toMatch(/allow read: if true/);
    expect(b).toMatch(/allow create: if isAdminUp\(\) && parishOk\(id\) && request\.resource\.data\.groupIds == \[\]/);
    const upd = b.slice(b.indexOf('allow update'), b.indexOf('allow delete'));
    expect(upd).toMatch(/allow update: if isAdminUp\(\) && resource\.data\.slug == request\.resource\.data\.slug/);
    expect(upd).toMatch(/parishOk\(id\)/);
    expect(b).toMatch(/allow delete: if isAdminUp\(\)/);
    expect(b).not.toMatch(/isSuperAdmin/);
    expect(b).not.toMatch(/allow write/);
  });
  it('parishes: a move up or down may change only `order`, on any existing parish; nothing else escapes parishOk', () => {
    const upd = block('parishes').slice(block('parishes').indexOf('allow update'), block('parishes').indexOf('allow delete'));
    expect(upd).toMatch(/\|\|\s*\(request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['order'\]\)/);
    expect(upd).toMatch(/request\.resource\.data\.order is number/);
    // the slug check and the admin check apply to both branches (they are outside the parentheses)
    expect(upd.indexOf('isAdminUp()')).toBeLessThan(upd.indexOf('parishOk'));
    expect(upd.indexOf('resource.data.slug == request.resource.data.slug')).toBeLessThan(upd.indexOf('parishOk'));
  });
  it('a new parish: only known fields, the id equals the slug, Greek and English names and city required', () => {
    const fn = rules.slice(rules.indexOf('function parishOk'), rules.indexOf('match /parishes/'));
    expect(fn).toMatch(/keys\(\)\.hasOnly\(/);
    expect(fn).toMatch(/keys\(\)\.hasAll\(\s*\['slug', 'nameEn', 'nameEl', 'state', 'city', 'cityEl', 'address'/);
    expect(fn).toMatch(/request\.resource\.data\.slug == id/);
    ['nameEn', 'nameEl', 'city', 'cityEl', 'address'].forEach(f => expect(fn).toContain(`reqStr('${f}', 1,`));
    expect(fn).toMatch(/groupIds is list/);
  });
  it('a parish location is a Google Maps link and a parish photo is from our Storage; same pattern as the app', () => {
    expect(rules).toContain(MAP_URL_PATTERN);
    const fn = rules.slice(rules.indexOf('function parishOk'), rules.indexOf('match /parishes/'));
    expect(fn).toContain("matches('https://firebasestorage[.]googleapis[.]com/.*')");
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
  it('the old structured "services" collection is gone: no rule, no code', () => {
    expect(rules).not.toMatch(/match \/services\//);
    expect(code).not.toMatch(/'services'/);
  });
  it('service days are public to read and written only for a parish the person may edit', () => {
    const b = block('serviceDays');
    expect(b).toMatch(/allow read: if true/);
    expect(b).toMatch(/allow create: if dayOk\(id\) && canEditParish\(request\.resource\.data\.parishId\)/);
    expect(b).toMatch(/allow update: if dayOk\(id\)\s*&& request\.resource\.data\.parishId == resource\.data\.parishId\s*&& request\.resource\.data\.date == resource\.data\.date\s*&& canEditParish\(resource\.data\.parishId\)/);
    expect(b).toMatch(/allow delete: if canEditParish\(resource\.data\.parishId\)/);
  });
  it('a service day must be named parishId_date, carry the right month, and have bounded text', () => {
    const fn = rules.slice(rules.indexOf('function dayOk'), rules.indexOf('match /serviceDays'));
    expect(fn).toMatch(/id == request\.resource\.data\.parishId \+ '_' \+ request\.resource\.data\.date/);
    expect(fn).toMatch(/yearMonth ==\s*request\.resource\.data\.date\.split\('-'\)\[0\] \+ '-' \+ request\.resource\.data\.date\.split\('-'\)\[1\]/);
    expect(fn).toMatch(/date\.matches\('\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}'\)/);
    expect(fn).toMatch(/entriesEn\.size\(\) <= 4000/);
    expect(fn).toMatch(/entriesEl\.size\(\) <= 4000/);
    expect(fn).toMatch(/updatedAt == request\.time/);
    expect(DAY_TEXT_MAX).toBe(4000);
  });
  it('what the editor writes for a day is exactly what the rules allow', () => {
    const fn = rules.slice(rules.indexOf('function dayOk'), rules.indexOf('match /serviceDays'));
    const allowed = [...fn.match(/hasOnly\(\[([^\]]*)\]/)![1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort();
    const sent = [...Object.keys(serviceDayPayload('p', '2026-11-25', 'a', 'b')), 'updatedAt'].sort();   // saveServiceDay adds updatedAt
    expect(sent).toEqual(allowed);
    expect(code).toMatch(/\{ \.\.\.serviceDayPayload\(parishId, date, entriesEn, entriesEl\), updatedAt: serverTimestamp\(\) \}/);
    expect(serviceDayId('holy-trinity', '2026-11-25')).toBe('holy-trinity_2026-11-25');
  });
  it('templates and quick entries: coordinators and admins read, only admins write, fields match the app', () => {
    for (const name of ['serviceTemplates', 'serviceEntryTypes']) {
      const b = block(name);
      expect(b, name).toMatch(/allow read: if isCoordinator\(\) \|\| isAdminUp\(\)/);
      expect(b, name).toMatch(/allow create, update: if isAdminUp\(\)/);
      expect(b, name).toMatch(/allow delete: if isAdminUp\(\)/);
      expect(b, name).not.toMatch(/if true/);
    }
    const keysOf = (name: string) => [...block(name).match(/hasOnly\(\[([^\]]*)\]/)![1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort();
    const tpl = { id: 'x', nameEn: 'a', nameEl: 'b', entriesEn: 'c', entriesEl: 'd', order: 1 };
    expect(Object.keys(templatePayload(tpl)).sort()).toEqual(keysOf('serviceTemplates'));
    expect(Object.keys(entryTypePayload({ id: 'x', textEn: 'a', textEl: 'b', order: 1 })).sort()).toEqual(keysOf('serviceEntryTypes'));
    expect(Object.keys(templatePayload(tpl))).not.toContain('id');
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
  it('needs no composite index: every query filters on one field, or orders by one', () => {
    expect(indexes.indexes).toEqual([]);
    expect(code).toMatch(/where\('yearMonth', '==', yearMonth\)/);
    expect(code).not.toMatch(/where\([^)]*\)[^;]*where\(/);                    // never two filters in one query
    expect(code).not.toMatch(/where\([^)]*\)[^;]*orderBy\(/);                   // never a filter plus an ordering
  });
})

describe('more rules', () => {
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
  it('only avatars/<uid>/<file> and parishes/<id>/<file> are open for anything; everything else is denied by default', () => {
    expect(storage).toMatch(/match \/avatars\/\{uid\}\/\{file\}/);
    expect(storage).not.toMatch(/allPaths/);
    expect(storage).not.toMatch(/allow\s+(create|update|write|delete)[^;]*if true/);
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
  it('parish photos: anyone reads (public page), only admins write, JPEG under 3 MB', () => {
    const b = storage.slice(storage.indexOf('match /parishes/'));
    expect(b).toMatch(/allow read: if true/);
    expect(b).toMatch(/allow create, update: if isAdminUp\(\)[\s\S]*size < 3 \* 1024 \* 1024[\s\S]*contentType == 'image\/jpeg'/);
    expect(b).toMatch(/allow delete: if isAdminUp\(\)/);
    expect(storage).toMatch(/firestore\.get\(\/databases\/\(default\)\/documents\/users\/\$\(request\.auth\.uid\)\)\.data\.role in \['admin', 'superadmin'\]/);
  });
});
