// src/themes/tokens.ts
// Single locked design (Option A — Cathedral Classic). Unlike the Russian
// parish site there is no swappable template system: one design for every
// parish, with only a small per-parish accent colour (Parish.accentColor).
// These tokens are applied as CSS variables in index.css.

export const tokens = {
  primary:   '#7A1F0A', // deep maroon — header
  primaryDk: '#5E1707',
  cream:     '#F3E8D9', // hero band
  gold:      '#C9A66C', // accent
  goldLt:    '#E7D3A6', // title text on maroon
  navText:   '#D8B98A',
  fontDisplay: "'Cormorant Garamond', serif",
  fontBody:    "'Nunito Sans', sans-serif",
} as const;

// Fallback accent for a parish with no accentColor set.
export const DEFAULT_PARISH_ACCENT = '#8B5E3C';
