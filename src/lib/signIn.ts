// src/lib/signIn.ts
// How a person signs in, as stored on their users/{uid} profile (so admins can see it).
// Firebase only tells the signed-in person their own providers, hence the copy in the profile.

export type SignInMethod = 'google' | 'password';

const METHOD_BY_PROVIDER: Record<string, SignInMethod> = { 'google.com': 'google', 'password': 'password' };

/** Firebase providerData -> our two methods, without duplicates, in a fixed order. */
export function signInMethods(providerData: { providerId: string }[] | undefined | null): SignInMethod[] {
  const found = new Set((providerData ?? []).map(p => METHOD_BY_PROVIDER[p.providerId]).filter(Boolean));
  return (['google', 'password'] as SignInMethod[]).filter(m => found.has(m));
}

/** "Google", "Email", "Email + Google"; "Unknown" for a profile that has not recorded it yet. */
export function signInLabel(methods: SignInMethod[]): string {
  if (!methods.length) return 'Unknown';
  return methods.map(m => (m === 'google' ? 'Google' : 'Email')).sort().join(' + ');
}
