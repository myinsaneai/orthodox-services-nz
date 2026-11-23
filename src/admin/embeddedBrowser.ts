// src/admin/embeddedBrowser.ts
// Google refuses to sign people in inside the built-in browser of other apps.
// 'blocked' = known for certain (disable the Google button),
// 'maybe'   = often a problem (show a hint), 'ok' = a normal browser.

export type EmbeddedKind = 'blocked' | 'maybe' | 'ok';

export function embeddedBrowser(ua: string): EmbeddedKind {
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram/i.test(ua)) return 'blocked';
  if (/Telegram|Viber|VKAndroidApp|vkclient|OKApp|Odnoklassniki|TikTok|musical_ly|Bytedance|Snapchat|Twitter|LinkedInApp|; wv\)|\bLine\//i.test(ua)) return 'maybe';
  return 'ok';
}
