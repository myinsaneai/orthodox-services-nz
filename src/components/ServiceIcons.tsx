// src/components/ServiceIcons.tsx
// Small line-art icons for the Services calendar: one per fasting level, plus a church that marks
// a day with a posted schedule. Shapes and colours match the Russian parish site so that people
// who use both recognise them. Each is decorative (aria-hidden); the meaning is always also
// given in text next to it or as a title.

import { FAST_COLOR } from '../lib/greekFeasts';
import type { FastType } from '../lib/greekFeasts';

export type FastIconType = Exclude<FastType, 'fastfree'>;

export function FastIcon({ type, size = 14 }: { type: FastIconType; size?: number }) {
  const outline = { fill: FAST_COLOR[type], stroke: '#fff', strokeWidth: 1, strokeLinejoin: 'round' as const };
  const svg = (children: React.ReactNode) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-fast={type}>
      {children}
    </svg>
  );
  switch (type) {
    case 'strict':    // upright plus
      return svg(<path {...outline} d="M9 1.5h6v7.5h7.5v6H15v7.5H9V15H1.5V9H9z" />);
    case 'oilwine':   // oil drop
      return svg(<path {...outline} d="M12 2.2 18.5 9.5A8 8 0 1 1 5.5 9.5z" />);
    case 'fish':      // fish with forked tail
      return svg(<>
        <path {...outline} d="M1 12Q4 4 12 6L16 9L23 4L17 12L23 20L16 15Q4 20 1 12Z" />
        <circle cx="7" cy="9.2" r="1.4" fill="#fff" />
      </>);
    case 'dairy':     // cheese wedge
      return svg(<>
        <path {...outline} d="M12 2 22 20.5H2z" />
        <circle cx="12" cy="13.5" r="1.7" fill="#fff" />
        <circle cx="16.8" cy="17" r="1.2" fill="#fff" />
        <circle cx="8" cy="17.3" r="1" fill="#fff" />
      </>);
    case 'totalfast': // diagonal cross
      return svg(<path {...outline} d="M2 4.5 4.5 2 12 9.5 19.5 2 22 4.5 14.5 12 22 19.5 19.5 22 12 14.5 4.5 22 2 19.5 9.5 12Z" />);
    default:
      return null;
  }
}

export function ChurchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon="church">
      <path fill="var(--color-primary)" stroke="#fff" strokeWidth="1" strokeLinejoin="round" d="M12,5.5 21,13 21,22 3,22 3,13 Z" />
      <rect x="11" y="0.6" width="2" height="5.5" fill="var(--color-primary)" stroke="#fff" strokeWidth="0.8" />
      <rect x="9.3" y="2.1" width="5.4" height="1.8" fill="var(--color-primary)" stroke="#fff" strokeWidth="0.8" />
      <rect x="10" y="16" width="4" height="6" fill="#fff" />
    </svg>
  );
}
