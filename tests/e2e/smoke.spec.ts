import { test, expect } from "@playwright/test";

test("home page renders 이지스톡 heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "이지스톡" })).toBeVisible();
});
