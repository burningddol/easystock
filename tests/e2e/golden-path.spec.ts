import { test, expect } from "@playwright/test";
import {
  cleanupTestUser,
  createTestUser,
  hasSupabaseTestEnv,
  type TestUser,
} from "../helpers/test-supabase";
import { dismissConsentBanner } from "./helpers/page";

/**
 * 페르소나 골든패스 (헌법 v1.3.0 E2E 의무).
 *
 * 가입한 사장님이 5분 안에 가치를 느끼는 흐름:
 *   로그인 → 메뉴 템플릿 → 매입 등록(단가 형성) → 판매 입력 →
 *   실제 마진율 확인 → 저장
 *
 * Supabase env 미설정 환경(CI 기본)에선 skip. 로컬 `.env.local`이나 CI에
 * SUPABASE_* secret이 있을 때만 실제 실행.
 */

test.describe("골든패스: 가입 → 메뉴 → 매입 → 판매 → 마진", () => {
  test.skip(!hasSupabaseTestEnv, "Supabase env not configured — golden path E2E skipped");

  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser({ storeType: "bingsu_cafe", storeName: "E2E 빙수카페" });
  });

  test.afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  });

  test("템플릿 → 매입(얼음 1000g @ 5000원) → 팥빙수 1개 판매 → 마진 ~83% (5분 이내)", async ({
    page,
  }) => {
    // T169: 페르소나 골든패스 wall-clock 시간을 5분 이내로 제한 (SC-001/SC-007).
    // E2E는 사람보다 훨씬 빠르므로 경고 임계로 충분 — 회귀 시 disconnect/retry 누적이
    // 5분에 가까워지면 조기 알림.
    const startedAt = Date.now();

    // 1) 로그인
    await page.goto("/login");
    await dismissConsentBanner(page);
    await page.getByLabel("이메일").fill(user.email);
    await page.getByLabel("비밀번호").fill(user.password);
    await page.getByRole("button", { name: /로그인/ }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 10_000 });

    // 2) 메뉴 템플릿 (빙수카페 8종)
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "템플릿으로 빠르게 시작" })).toBeVisible();
    await page.getByRole("button", { name: "템플릿 불러오기" }).click();
    await expect(page.getByRole("link", { name: /팥빙수/ })).toBeVisible({ timeout: 10_000 });

    // 3) 매입 등록 — 얼음만 매입해 단가 형성. 다른 재료는 0원 유지(부분 마진).
    await page.goto("/purchase");

    // 거래처: 신규 추가. 폼 input들의 name 속성 직접 지정 (라벨이 PurchaseForm 안에서 중복 매칭됨).
    await page.getByRole("button", { name: "+ 신규" }).first().click();
    await page.locator('input[name="name"]').fill("E2E 도매상");
    await page.locator('input[name="leadTimeDays"]').fill("1");

    // save_vendor RPC 응답 + 캐시 invalidate + select 모드 복귀 + 새 vendor가 option으로 등장 — 모두 대기
    const saveVendorResponse = page.waitForResponse((res) =>
      res.url().includes("/rest/v1/rpc/save_vendor"),
    );
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await saveVendorResponse;
    await expect(page.locator('select[name="vendorId"]')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('select[name="vendorId"] option', { hasText: "E2E 도매상" }),
    ).toBeAttached({ timeout: 10_000 });

    // 항목: 얼음 select + 수량 1000 + 금액 5000 (단가 5원/g)
    // react-hook-form의 name 속성 직접 사용 — 라벨은 중첩 구조로 모호함.
    await page.locator('select[name="items.0.ingredientId"]').selectOption({ label: "얼음 (g)" });
    await page.locator('input[name="items.0.quantity"]').fill("1000");
    await page.locator('input[name="items.0.amount"]').fill("5000");

    // 매입 저장 + RPC 응답 대기. 폼 검증 + 가중평균 계산 + history insert 등으로
    // 가끔 dev 서버가 느려지는 경우가 있어 timeout 여유.
    const savePurchaseResponse = page.waitForResponse(
      (res) => res.url().includes("/rest/v1/rpc/save_purchase"),
      { timeout: 20_000 },
    );
    await page.getByRole("button", { name: "매입 저장" }).click();
    const response = await savePurchaseResponse;
    expect(response.status()).toBe(200);

    // 첫 매입 → ±5% alert 없음 → 즉시 /inventory
    await expect(page).toHaveURL(/\/inventory/, { timeout: 10_000 });

    // 4) 판매 입력: 팥빙수 +1
    await page.goto("/sale");
    const palbingsuRow = page.getByRole("listitem").filter({ hasText: "팥빙수" });
    await expect(palbingsuRow).toBeVisible({ timeout: 10_000 });
    await palbingsuRow.getByRole("button", { name: /수량 \+1/ }).click();

    // 5) 실시간 마진율 검증
    // 팥빙수 = 얼음 300g × 5원 = 1500원 원가 (다른 재료 단가 0)
    // 매출 9000원, 순수익 7500원, 마진율 (7500/9000) × 100 ≈ 83%
    await expect(page.getByText("재료 원가 기준 (이동평균법)")).toBeVisible();
    await expect(page.getByText(/마진 83%/)).toBeVisible();
    // 100%이면 매입 흐름이 단가에 반영 안 된 것
    await expect(page.getByText("마진 100%")).not.toBeVisible();

    // 6) 저장 → /today 복귀
    const saveButton = page.getByRole("button", { name: /1개 저장/ });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await expect(page).toHaveURL(/\/today/, { timeout: 10_000 });

    // 7) 페르소나 시간 게이트 (T169, SC-001/SC-007)
    const elapsedMs = Date.now() - startedAt;
    expect(
      elapsedMs,
      `골든패스 5분 초과: ${(elapsedMs / 1000).toFixed(1)}s — 회귀로 사용자 마찰 누적 가능`,
    ).toBeLessThan(5 * 60 * 1000);
  });
});
