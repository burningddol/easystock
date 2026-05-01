// Vitest 전용 헬퍼 — Playwright (e2e)가 import하면 vitest 의존이 e2e 런타임에 흘러들어가
// 별도 파일로 분리. tests/helpers/test-supabase.ts는 vitest와 playwright가 공용.

import { describe } from "vitest";
import { hasSupabaseTestEnv } from "./test-supabase";

/** Supabase env가 있을 때만 통합 테스트 suite 실행 — 9개 파일에서 반복되던 패턴 단일 출처. */
export const describeIfSupabase = hasSupabaseTestEnv ? describe : describe.skip;
