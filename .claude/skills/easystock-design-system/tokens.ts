/**
 * 이지스톡 디자인 토큰 (TypeScript)
 *
 * - Tailwind config에 import: tailwind.config.ts에서 colors: tokens.color.light 식으로 사용
 * - styled-components / Emotion에서 직접 사용 가능
 * - CSS 변수와 일치 (globals.css 참조)
 */

export const color = {
  light: {
    bg: '#f7f6f2',
    card: '#ffffff',
    cardHover: '#f1efe9',
    ink1: '#1a1a1a',
    ink2: '#43423f',
    ink3: '#87857f',
    ink4: '#c4c1b8',
    border: '#e8e5db',
    borderStrong: '#b8b4a8',
  },
  dark: {
    bg: '#161513',
    card: '#1f1d1a',
    cardHover: '#2a2724',
    ink1: '#f0ede5',
    ink2: '#c8c4b8',
    ink3: '#8a8780',
    ink4: '#5a5752',
    border: '#2e2c28',
    borderStrong: '#4a4742',
  },
  status: {
    red:   { main: '#d6493a', deep: '#8a2c1f', soft: '#fbe6e1', softDark: '#3a1a14' },
    amber: { main: '#b07d1a', deep: '#6e4a08', soft: '#fbf0d4', softDark: '#3a2a10' },
    green: { main: '#4a8a52', deep: '#2c5a35', soft: '#e1f0e2', softDark: '#1a2a1d' },
    blue:  { main: '#3e7bb4', deep: '#234a72', soft: '#dde9f4', softDark: '#18283a' },
  },
} as const;

export const typography = {
  family: "'Pretendard', ui-sans-serif, system-ui, sans-serif",
  numericFeature: { fontVariantNumeric: 'tabular-nums' as const, fontFeatureSettings: '"tnum"' },

  metricHero:   { fontSize: 30,   fontWeight: 700, letterSpacing: '-0.02em' },
  metricLg:     { fontSize: 24,   fontWeight: 700, letterSpacing: '-0.02em' },
  metricMd:     { fontSize: 16,   fontWeight: 700 },
  titleLg:      { fontSize: 22,   fontWeight: 700, letterSpacing: '-0.01em' },
  titleMd:      { fontSize: 18,   fontWeight: 700 },
  body:         { fontSize: 13.5, fontWeight: 600 },
  bodyRegular:  { fontSize: 13,   fontWeight: 500 },
  label:        { fontSize: 12,   fontWeight: 600 },
  caption:      { fontSize: 11.5, fontWeight: 500 },
  micro:        { fontSize: 10.5, fontWeight: 600 },
} as const;

export const spacing = {
  tilePadding: 14,
  cardPadding: 14,
  screenPadding: 16,
  sectionGap: 20,
  stackTight: 8,
  stack: 12,
  stackLoose: 20,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const stroke = {
  hairline: '1px solid var(--border)',
  strong:   '1px solid var(--border-strong)',
  dashed:   '1px dashed var(--border-strong)',
} as const;

export const interaction = {
  tapMin: 44,
  transition: 'all 150ms ease-out',
} as const;

/* ─── cn 유틸 (선택) ─────────────────────────────── */
export function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(' ');
}

/* ─── 숫자 포맷 ──────────────────────────────────── */
export const fmt = {
  /** 1234567 → "1,234,567" */
  num: (n: number) => n.toLocaleString('ko-KR'),
  /** 1234567 → "123만" */
  manwon: (n: number) => `${Math.round(n / 10000).toLocaleString('ko-KR')}만`,
  /** 24.5 → "24.5%" */
  pct: (n: number, decimals = 0) => `${n.toFixed(decimals)}%`,
};

/* ─── CSS 변수 출력 (globals.css 생성용) ─────────── */
export function cssVarBlock(theme: 'light' | 'dark' = 'light'): string {
  const c = theme === 'light' ? color.light : color.dark;
  const lines = [
    `--bg: ${c.bg};`,
    `--card: ${c.card};`,
    `--card-hover: ${c.cardHover};`,
    `--ink-1: ${c.ink1};`,
    `--ink-2: ${c.ink2};`,
    `--ink-3: ${c.ink3};`,
    `--ink-4: ${c.ink4};`,
    `--border: ${c.border};`,
    `--border-strong: ${c.borderStrong};`,
    ...Object.entries(color.status).flatMap(([k, v]) => [
      `--c-${k}: ${v.main};`,
      `--c-${k}-deep: ${v.deep};`,
      `--c-${k}-soft: ${theme === 'light' ? v.soft : v.softDark};`,
    ]),
  ];
  return lines.join('\n  ');
}

export const tokens = { color, typography, spacing, radius, stroke, interaction, fmt };
export default tokens;
