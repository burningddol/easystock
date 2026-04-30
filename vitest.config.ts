import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// `.env.local` 등 dotenv 파일을 vitest에 주입.
// CI는 GitHub Secrets가 process.env에 직접 들어가서 그대로 작동.
const env = loadEnv("", process.cwd(), "");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    env,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      // 헌법 v1.3.0: 단위 테스트 의무는 핵심 도메인 + 비즈니스 로직.
      // UI 컴포넌트 / 페이지 / 훅 / 외부 클라이언트 wrapper는 시각 회귀 + 통합/E2E 테스트로
      // 보완 (수동 검증 포함) → coverage 분모에서 제외.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "src/types/**",
        "src/app/**",
        "src/components/**",
        "src/features/**/components/**",
        "src/features/**/hooks/**",
        // 단순 Zod 스키마 (런타임 검증만, 분기 로직 없음)
        "src/features/**/schemas.ts",
        "src/lib/supabase/types.ts",
        "src/lib/supabase/client.ts",
        "src/lib/supabase/server.ts",
        "src/lib/push/client.ts",
        "src/lib/analytics/**",
        "src/lib/utils/use-today-iso.ts",
        // TanStack Query / shadcn cn / design-tokens 재export — 트리비얼 wrapper
        "src/lib/query-client.ts",
        "src/lib/design-tokens.ts",
        "src/lib/utils.ts",
        "src/stores/**",
      ],
    },
  },
});
