import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// .env.local 등 dotenv 파일을 process.env에 주입.
// 로컬: .env.local에서 SUPABASE_* 자동 로드 → 골든패스 E2E 실제 실행
// CI: GitHub secret이 process.env에 직접 들어가서 그대로 작동.
Object.assign(process.env, loadEnv("", process.cwd(), ""));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
