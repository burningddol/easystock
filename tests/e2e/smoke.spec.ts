import { test, expect } from "@playwright/test";

test("/ 비로그인 진입 시 /login으로 redirect", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
