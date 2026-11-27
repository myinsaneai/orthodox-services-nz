// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getFavouriteIds, setFavourite, subscribeFavourites } from '../src/lib/favourites';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('favourites store', () => {
  it('starts empty and keeps the order they were starred in', () => {
    expect(getFavouriteIds()).toEqual([]);
    setFavourite('b', true); setFavourite('a', true);
    expect(getFavouriteIds()).toEqual(['b', 'a']);
  });
  it('starring twice does not repeat, un-starring removes, and the last removal clears the storage key', () => {
    setFavourite('a', true); setFavourite('a', true);
    expect(getFavouriteIds()).toEqual(['a']);
    setFavourite('b', true);
    setFavourite('a', false);
    expect(getFavouriteIds()).toEqual(['b']);
    setFavourite('zzz', false);                              // not there: nothing happens
    expect(getFavouriteIds()).toEqual(['b']);
    setFavourite('b', false);
    expect(localStorage.getItem('gp_fav_parishes')).toBeNull();
  });
  it('returns the very same array while nothing changed (needed by useSyncExternalStore)', () => {
    setFavourite('a', true);
    expect(getFavouriteIds()).toBe(getFavouriteIds());
    const before = getFavouriteIds();
    setFavourite('b', true);
    expect(getFavouriteIds()).not.toBe(before);
  });
  it('ignores damaged or odd stored values', () => {
    for (const bad of ['not json', '{"a":1}', '5', 'null', '[1,{},null]']) {
      localStorage.setItem('gp_fav_parishes', bad);
      expect(getFavouriteIds()).toEqual([]);
    }
    localStorage.setItem('gp_fav_parishes', JSON.stringify(['a', 7, 'a', '', 'b']));
    expect(getFavouriteIds()).toEqual(['a', 'b']);
  });
  it('limits what it keeps', () => {
    localStorage.setItem('gp_fav_parishes', JSON.stringify(Array.from({ length: 500 }, (_, i) => `p${i}`)));
    expect(getFavouriteIds()).toHaveLength(200);
  });
  it('tells listeners about a change here and about a change made in another tab', () => {
    const cb = vi.fn();
    const off = subscribeFavourites(cb);
    setFavourite('a', true);
    expect(cb).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'gp_fav_parishes' }));
    expect(cb).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent('storage', { key: 'something_else' }));
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    setFavourite('b', true);
    expect(cb).toHaveBeenCalledTimes(2);
  });
  it('still works for the page when the browser will not store anything', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(setFavourite('a', true)).toBe(false);
    expect(getFavouriteIds()).toEqual([]);                   // nothing stored, nothing shown, no crash
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getFavouriteIds()).toEqual([]);
  });
});
