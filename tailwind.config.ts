import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * 디자인 시스템 토큰의 빌드 타임 사본.
 * 단일 진실 공급원: `.claude/skills/easystock-design-system/tokens.ts`
 * 토큰 변경 시 이 파일도 동기화 (PR 4 결정: webpack이 tailwind config의
 * 외부 .ts import를 처리 못 해서 인라인).
 */

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        "card-hover": "var(--card-hover)",
        ink: {
          1: "var(--ink-1)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        red: {
          DEFAULT: "var(--c-red)",
          deep: "var(--c-red-deep)",
          soft: "var(--c-red-soft)",
        },
        amber: {
          DEFAULT: "var(--c-amber)",
          deep: "var(--c-amber-deep)",
          soft: "var(--c-amber-soft)",
        },
        green: {
          DEFAULT: "var(--c-green)",
          deep: "var(--c-green-deep)",
          soft: "var(--c-green-soft)",
        },
        blue: {
          DEFAULT: "var(--c-blue)",
          deep: "var(--c-blue-deep)",
          soft: "var(--c-blue-soft)",
        },
      },
      spacing: {
        tile: "14px",
        screen: "16px",
        section: "20px",
        "stack-tight": "8px",
        stack: "12px",
        "stack-loose": "20px",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "12px",
        xl: "16px",
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "metric-hero": ["30px", { fontWeight: 700, letterSpacing: "-0.02em" }],
        "metric-lg": ["24px", { fontWeight: 700, letterSpacing: "-0.02em" }],
        "metric-md": ["16px", { fontWeight: 700 }],
        "title-lg": ["22px", { fontWeight: 700, letterSpacing: "-0.01em" }],
        "title-md": ["18px", { fontWeight: 700 }],
        body: ["13.5px", { fontWeight: 600 }],
        "body-regular": ["13px", { fontWeight: 500 }],
        label: ["12px", { fontWeight: 600 }],
        caption: ["11.5px", { fontWeight: 500 }],
        micro: ["10.5px", { fontWeight: 600 }],
      },
    },
  },
  plugins: [animate],
};

export default config;
