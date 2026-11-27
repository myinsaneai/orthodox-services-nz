// src/hooks/useFavourites.ts
import { useSyncExternalStore } from 'react';
import { getFavouriteIds, subscribeFavourites } from '../lib/favourites';

const NONE: readonly string[] = [];

/** The starred parish ids of this browser; the page re-renders when they change (also from another tab). */
export function useFavourites(): readonly string[] {
  return useSyncExternalStore(subscribeFavourites, getFavouriteIds, () => NONE);
}
