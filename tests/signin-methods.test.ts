// How a person signs in: Firebase providers -> "Google" / "Email" labels.
import { describe, it, expect } from 'vitest';
import { signInMethods, signInLabel } from '../src/lib/signIn';

describe('signInMethods', () => {
  it('maps Firebase provider ids', () => {
    expect(signInMethods([{ providerId: 'google.com' }])).toEqual(['google']);
    expect(signInMethods([{ providerId: 'password' }])).toEqual(['password']);
  });
  it('lists both in a fixed order, once each', () => {
    expect(signInMethods([{ providerId: 'password' }, { providerId: 'google.com' }, { providerId: 'google.com' }]))
      .toEqual(['google', 'password']);
  });
  it('ignores providers the site does not use, and missing data', () => {
    expect(signInMethods([{ providerId: 'facebook.com' }, { providerId: 'phone' }])).toEqual([]);
    expect(signInMethods(undefined)).toEqual([]);
    expect(signInMethods(null)).toEqual([]);
  });
});

describe('signInLabel', () => {
  it('names the method', () => {
    expect(signInLabel(['google'])).toBe('Google');
    expect(signInLabel(['password'])).toBe('Email');
    expect(signInLabel(['google', 'password'])).toBe('Email + Google');
  });
  it('says Unknown for a profile that has not recorded it yet', () => {
    expect(signInLabel([])).toBe('Unknown');
  });
});
