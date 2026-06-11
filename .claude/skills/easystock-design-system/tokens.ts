/**
 * 이지스톡 디자인 토큰 (TypeScript)
 *
 * - Tailwind config에 import: tailwind.config.ts에서 colors: tokens.color.light 식으로 사용
 * - styled-components / Emotion에서 직접 사용 가능
 * - CSS 변수와 일치 (globals.css 참조)
 */

export const color = {
  light: {
    bg: '#f5f7fb',
    card: '#ffffff',
    cardHover: '#f8fbff',
    ink1: '#191f28',
    ink2: '#4e5968',
    ink3: '#8b95a1',
    ink4: '#b0b8c1',
    border: '#e5e8eb',
    borderStrong: '#d1d6db',
  },
  dark: {
    bg: '#111318',
    card: '#1a1f29',
    cardHover: '#232936',
    ink1: '#f8fafc',
    ink2: '#d5dbea',
    ink3: '#98a2b3',
    ink4: '#667085',
    border: '#2b3240',
    borderStrong: '#3a4252',
  },
  status: {
    red:   { main: '#f04452', deep: '#b42318', soft: '#fef0f1', softDark: '#3d1c20' },
    amber: { main: '#ffb020', deep: '#b54708', soft: '#fff4db', softDark: '#3b2912' },
    green: { main: '#16b364', deep: '#067647', soft: '#e8fff3', softDark: '#133225' },
    blue:  { main: '#3182f6', deep: '#1b64da', soft: '#eaf3ff', softDark: '#16263e' },
  },
} as const;

export const typography = {
  family: "'Pretendard', ui-sans-serif, system-ui, sans-serif",
  numericFeature: { fontVariantNumeric: 'tabular-nums' as const, fontFeatureSettings: '"tnum"' },

  metricHero:   { fontSize: 32,   fontWeight: 700, letterSpacing: '-0.03em' },
  metricLg:     { fontSize: 26,   fontWeight: 700, letterSpacing: '-0.025em' },
  metricMd:     { fontSize: 17,   fontWeight: 700 },
  titleLg:      { fontSize: 24,   fontWeight: 700, letterSpacing: '-0.02em' },
  titleMd:      { fontSize: 19,   fontWeight: 700, letterSpacing: '-0.015em' },
  body:         { fontSize: 13.5, fontWeight: 600 },
  bodyRegular:  { fontSize: 13,   fontWeight: 500 },
  label:        { fontSize: 12,   fontWeight: 600 },
  caption:      { fontSize: 11.5, fontWeight: 500 },
  micro:        { fontSize: 10.5, fontWeight: 600 },
} as const;

export const spacing = {
  tilePadding: 16,
  cardPadding: 16,
  screenPadding: 20,
  sectionGap: 24,
  stackTight: 10,
  stack: 14,
  stackLoose: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const stroke = {
  hairline: '1px solid var(--border)',
  strong:   '1px solid var(--border-strong)',
  dashed:   '1px dashed var(--border-strong)',
} as const;

export const shadow = {
  soft: '0 8px 24px rgba(15, 23, 42, 0.06)',
  card: '0 10px 30px rgba(15, 23, 42, 0.07)',
  lift: '0 16px 40px rgba(49, 130, 246, 0.12)',
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

export const tokens = { color, typography, spacing, radius, stroke, shadow, interaction, fmt };
export default tokens;
