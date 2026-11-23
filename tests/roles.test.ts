// The role table (src/lib/roles.ts): who may give which role to whom.
import { describe, it, expect } from 'vitest';
import {
  ROLES, ROLE_LABEL, rank, isAtLeast, isRole, assignableRoles, canChangeRole, canDeleteUser,
} from '../src/lib/roles';
import type { RoleName } from '../src/lib/roles';

describe('roles', () => {
  it('has the four roles from lowest to highest', () => {
    expect(ROLES).toEqual(['user', 'coordinator', 'admin', 'superadmin']);
    expect(ROLES.map(r => ROLE_LABEL[r])).toEqual(['User', 'Coordinator', 'Admin', 'SuperAdmin']);
  });
  it('ranks them, and nobody ranks below everybody', () => {
    expect(ROLES.map(r => rank(r))).toEqual([0, 1, 2, 3]);
    expect(rank(null)).toBe(-1);
    expect(isAtLeast('admin', 'coordinator')).toBe(true);
    expect(isAtLeast('coordinator', 'admin')).toBe(false);
    expect(isAtLeast(null, 'user')).toBe(false);
  });
  it('recognises only real roles', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('parish-admin')).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole('1')).toBe(false);
  });
});

describe('assignableRoles', () => {
  it('a superadmin may give any role to anyone', () => {
    ROLES.forEach(t => expect(assignableRoles('superadmin', t)).toEqual(ROLES));
  });
  it('an admin may give user, coordinator or admin, but only to a user or a coordinator', () => {
    (['user', 'coordinator'] as RoleName[]).forEach(t =>
      expect(assignableRoles('admin', t)).toEqual(['user', 'coordinator', 'admin']));
    (['admin', 'superadmin'] as RoleName[]).forEach(t =>
      expect(assignableRoles('admin', t)).toEqual([]));
  });
  it('an admin can never make a superadmin', () => {
    ROLES.forEach(t => expect(assignableRoles('admin', t)).not.toContain('superadmin'));
  });
  it('coordinators, users and guests may change nobody', () => {
    (['coordinator', 'user', null] as (RoleName | null)[]).forEach(a =>
      ROLES.forEach(t => expect(assignableRoles(a, t)).toEqual([])));
  });
});

describe('canChangeRole / canDeleteUser', () => {
  it('nobody changes or deletes themselves', () => {
    expect(canChangeRole('superadmin', 'me', 'user', 'me')).toBe(false);
    expect(canDeleteUser('superadmin', 'me', 'me')).toBe(false);
  });
  it('an admin changes a user, not another admin', () => {
    expect(canChangeRole('admin', 'a', 'user', 'b')).toBe(true);
    expect(canChangeRole('admin', 'a', 'coordinator', 'b')).toBe(true);
    expect(canChangeRole('admin', 'a', 'admin', 'b')).toBe(false);
    expect(canChangeRole('admin', 'a', 'superadmin', 'b')).toBe(false);
  });
  it('a superadmin changes anybody else', () => {
    ROLES.forEach(t => expect(canChangeRole('superadmin', 'a', t, 'b')).toBe(true));
  });
  it('only a superadmin deletes, and only somebody else', () => {
    expect(canDeleteUser('superadmin', 'a', 'b')).toBe(true);
    (['admin', 'coordinator', 'user', null] as (RoleName | null)[]).forEach(a =>
      expect(canDeleteUser(a, 'a', 'b')).toBe(false));
  });
});
