import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitWithin, checkImageFile, MAX_EDGE, MAX_INPUT_BYTES } from '../src/lib/image';
import { PHOTO_URL_PATTERN, safePhotoUrl } from '../src/lib/photoUrl';

describe('fitWithin (longest edge at most 1024)', () => {
  it('shrinks a wide picture, keeping proportions', () => {
    expect(fitWithin(3000, 2000)).toEqual({ width: 1024, height: 683 });
  });
  it('shrinks a tall picture', () => {
    expect(fitWithin(2000, 4000)).toEqual({ width: 512, height: 1024 });
  });
  it('shrinks a square picture', () => {
    expect(fitWithin(5000, 5000)).toEqual({ width: 1024, height: 1024 });
  });
  it('never enlarges, and leaves exactly 1024 alone', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(1024, 1024)).toEqual({ width: 1024, height: 1024 });
    expect(fitWithin(1024, 500)).toEqual({ width: 1024, height: 500 });
  });
  it('keeps a very thin picture at least 1 px', () => {
    expect(fitWithin(20000, 5)).toEqual({ width: 1024, height: 1 });
  });
  it('MAX_EDGE is 1024', () => { expect(MAX_EDGE).toBe(1024); });
});

describe('checkImageFile', () => {
  it('accepts JPEG, PNG, WebP and GIF', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
      expect(checkImageFile({ type, size: 1000 })).toBeNull();
  });
  it('refuses other types, empty files and huge files', () => {
    expect(checkImageFile({ type: 'application/pdf', size: 1000 })).toMatch(/JPEG, PNG/);
    expect(checkImageFile({ type: 'image/svg+xml', size: 1000 })).toMatch(/JPEG, PNG/);
    expect(checkImageFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(checkImageFile({ type: 'image/png', size: MAX_INPUT_BYTES + 1 })).toMatch(/too large/);
  });
});

describe('safePhotoUrl', () => {
  it('allows Google pictures and our Firebase Storage', () => {
    expect(safePhotoUrl('https://lh3.googleusercontent.com/a/abc=s96-c')).not.toBe('');
    expect(safePhotoUrl('https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Fu%2F1.jpg?alt=media')).not.toBe('');
  });
  it('drops everything else', () => {
    for (const u of ['http://lh3.googleusercontent.com/a', 'https://evil.example/a.jpg',
      'https://googleusercontent.com.evil.example/a', 'https://evilgoogleusercontent.com/a',
      'javascript:alert(1)', '', null, undefined])
      expect(safePhotoUrl(u as string)).toBe('');
  });
  it('drops absurdly long addresses', () => {
    expect(safePhotoUrl('https://lh3.googleusercontent.com/' + 'a'.repeat(2000))).toBe('');
  });
  it('uses the same pattern as firestore.rules', () => {
    expect(readFileSync('firestore.rules', 'utf8')).toContain(PHOTO_URL_PATTERN);
  });
});
