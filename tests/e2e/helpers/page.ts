import type { Page } from "@playwright/test";

/**
 * E2E 헬퍼.
 * 모든 시나리오에서 공통으로 필요한 페이지 상호작용 (배너 dismiss 등).
 */

/**
 * PIPA 쿠키 동의 배너를 즉시 dismiss.
 * 배너는 z-50으로 화면 하단을 점유 → 저장/액션 버튼을 가려서 click 인터셉트.
 *
 * 첫 방문 시 mount 타이밍에 따라 isVisible 반환 시점에 따라 race가 있어
 * waitFor + catch로 "안 뜨면 그냥 패스"하게 한다.
 */
export async function dismissConsentBanner(page: Page): Promise<void> {
  const banner = page.getByRole("dialog", { name: "쿠키 동의" });
  await banner.waitFor({ state: "visible", timeout: 2000 }).catch(() => {
    /* 배너가 안 뜨는 환경(이미 처리됨) — 무시 */
  });
  if (await banner.isVisible()) {
    await banner.getByRole("button", { name: "거부" }).click();
  }
}
