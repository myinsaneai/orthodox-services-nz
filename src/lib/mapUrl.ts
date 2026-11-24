// src/lib/mapUrl.ts
// A parish's location is a Google Maps link. Only Google Maps addresses are accepted, so a
// parish page can never send visitors to a stranger's site. firestore.rules holds the same
// pattern (a test keeps the two identical).

export const MAP_URL_PATTERN =
  'https://(www[.])?google[.]([a-z]+[.])?[a-z]+/maps.*|https://maps[.]google[.]([a-z]+[.])?[a-z]+/.*|https://maps[.]app[.]goo[.]gl/.*|https://goo[.]gl/maps/.*';

const RE = new RegExp(`^(?:${MAP_URL_PATTERN})$`);

export const MAP_URL_MAX = 500;

export const isMapUrl = (url: string): boolean => url.length <= MAP_URL_MAX && RE.test(url);

/** The link if it is a Google Maps address, otherwise an empty string. */
export const safeMapUrl = (url: string | null | undefined): string => (url && isMapUrl(url) ? url : '');
