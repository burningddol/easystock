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
 *   로그인 → 메뉴 템플릿 불러오기 → 판매 입력 → 매출/마진 확인 → 저장.
 *
 * Supabase env 미설정 환경(CI 기본)에선 skip. 로컬 `.env.local`이나 CI에
 * SUPABASE_* secret이 있을 때만 실제 실행.
 */

test.describe("골든패스: 가입 → 메뉴 → 판매 → 마진", () => {
  test.skip(!hasSupabaseTestEnv, "Supabase env not configured — golden path E2E skipped");

  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser({ storeType: "bingsu_cafe", storeName: "E2E 빙수카페" });
  });

  test.afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  });

  test("로그인 후 빙수카페 템플릿 불러오기 + 팥빙수 1개 판매 입력", async ({ page }) => {
    // 1) 로그인
    await page.goto("/login");
    await dismissConsentBanner(page);

    await page.getByLabel("이메일").fill(user.email);
    await page.getByLabel("비밀번호").fill(user.password);
    await page.getByRole("button", { name: /로그인/ }).click();

    await expect(page).toHaveURL(/\/today/, { timeout: 10_000 });

    // 2) 메뉴 → 콜드스타트 다이얼로그
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "템플릿으로 빠르게 시작" })).toBeVisible();

    // 빙수카페가 기본 선택. 불러오기 클릭.
    await page.getByRole("button", { name: "템플릿 불러오기" }).click();

    // 8종 메뉴 행 등장 (다이얼로그 자동 사라짐)
    await expect(page.getByRole("link", { name: /팥빙수/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /망고빙수/ })).toBeVisible();

    // 3) 판매 입력 화면
    await page.goto("/sale");

    // 메뉴 리스트 로딩 대기
    const palbingsuRow = page.getByRole("listitem").filter({ hasText: "팥빙수" });
    await expect(palbingsuRow).toBeVisible({ timeout: 10_000 });

    // 팥빙수 +1
    await palbingsuRow.getByRole("button", { name: /수량 \+1/ }).click();

    // 4) StickyTotalCard에 MARGIN_LABEL 표시 (헌법 III).
    // 라벨이 보이면 sticky card가 preview를 받아 렌더링된 것 — 매출/원가는
    // 메뉴 가격 행과 텍스트가 겹쳐 별도 검증하지 않음.
    await expect(page.getByText("재료 원가 기준 (이동평균법)")).toBeVisible();

    // 마진율: 모든 단가 0이라 100% 표시 (Phase 5 매입 후 실제 단가 반영됨)
    await expect(page.getByText("마진 100%")).toBeVisible();

    // 5) 저장 → /today 복귀
    const saveButton = page.getByRole("button", { name: /1개 저장/ });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await expect(page).toHaveURL(/\/today/, { timeout: 10_000 });
  });
});
