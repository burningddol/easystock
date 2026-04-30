# 이지스톡 (EasyStock)

카페·빙수 자영업자를 위한 재고·원가 관리 PWA. 매일 입력하는 매입·판매 데이터에서 메뉴별 마진과 재료 소진 예측을 자동으로 계산합니다.

> **페르소나 가드**: 사장님이 5분 안에 가치를 못 느끼면 이탈합니다. **입력이 지속되는 것**이 모든 가치의 전제. 프로젝트 결정은 [CLAUDE.md](CLAUDE.md) 참조.

## 기술 스택

- **프론트** Next.js 15 App Router · React 19 · TypeScript 5 · Tailwind 3 · shadcn/ui
- **상태** TanStack Query (서버) · Zustand (폼 임시저장) · React Hook Form + Zod
- **백엔드** Supabase Postgres (RLS user_id 격리) · Edge Functions (Deno) · pg_cron · pg_net
- **테스트** Vitest (단위/통합) · Playwright (E2E)
- **배포** Vercel · Supabase Cloud · GitHub Actions CI

## 처음 셋업

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수

`.env.local` 생성 (`.env.example` 참조):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon JWT>

# Push (선택, 베타 활성화 시)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid public>
VAPID_PRIVATE_KEY=<vapid private>
VAPID_SUBJECT=mailto:hello@easystock.app

# 분석 (선택)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=<sentry dsn>
```

### 3. 외부 인프라 셋업 가이드

- **Supabase 마이그레이션 + Edge Function + pg_cron**: [docs/setup-push.md](docs/setup-push.md)
- **GitHub Secrets** (CI 빌드용): [docs/setup-github.md](docs/setup-github.md)
- **VAPID 키 페어 생성**: [docs/setup-vapid.md](docs/setup-vapid.md)

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000

## 자주 쓰는 명령

| 명령                                                                     | 설명                                  |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `npm run dev`                                                            | Next.js 개발 서버                     |
| `npm run build`                                                          | 프로덕션 빌드                         |
| `npm run typecheck`                                                      | TypeScript 타입 체크                  |
| `npm run lint`                                                           | ESLint                                |
| `npm run format:check`                                                   | Prettier 포맷 검사                    |
| `npm run test`                                                           | Vitest 단위 + 통합 (CI와 동일)        |
| `npm run test:e2e`                                                       | Playwright E2E                        |
| `npm run test:coverage`                                                  | 커버리지 (도메인 80% / 전체 60% 임계) |
| `npx supabase db push --linked --include-all`                            | 신규 마이그레이션 클라우드 적용       |
| `npx supabase gen types typescript --linked > src/lib/supabase/types.ts` | TS 타입 재생성                        |

## 디렉토리 구조

```text
src/
  app/(main)/              Next.js App Router 라우트 (5탭)
    today/                 홈 (오늘) — 어제 KPI / 알림 / 마진 TOP3
    calendar/              월간 캘린더
    sale/[date]/           판매 입력 (소급 포함)
    menu/                  메뉴 / 레시피
    inventory/             재고 / 소진 예측 / 실사
  features/                도메인별 분리 (sale / purchase / menu / inventory / dashboard / calendar)
  components/ui/           shadcn 원자 컴포넌트
  lib/
    domain/                헌법 III 핵심 (margin, pricing, snapshot, forecast)
    supabase/              client / rpc 래퍼 / types
    analytics/             GA4 + consent gate
    utils/                 format / use-today-iso 등
  types/                   도메인 타입
supabase/
  migrations/              순서대로 적용 (001~027)
  functions/               Edge Function (push-scheduler / d7-tracker / permanent-delete)
specs/001-mvp-core/        spec.md / data-model.md / contracts / tasks.md
```

## 헌법 (변경 시 spec 갱신 필수)

- **III. 마진 정의** — `재료 원가 기준 (이동평균법)`만 사용. 임대료·인건비 절대 미포함. UI에 항상 라벨 노출.
- **IV. 데이터 격리** — 모든 테이블에 RLS `user_id` 격리. 단일 사장님 전제지만 멀티테넌시 모델 유지.
- **테스트 v1.3.0** — 핵심 도메인 단위 + RLS 통합 + 페르소나 골든패스 E2E 의무. 도메인 80% / 전체 60% 커버리지 게이트.

상세는 [.specify/memory/constitution.md](.specify/memory/constitution.md).

## 디자인 시스템

`.claude/skills/easystock-design-system/` — 토큰·컴포넌트·6개 화면 패턴 단일 진실 공급원. 색·spacing은 [tokens.ts](.claude/skills/easystock-design-system/tokens.ts)에서 import (하드코딩 금지). Pretendard 폰트 강제. PWA manifest의 `theme_color`/`background_color`만 hex literal 예외.

## 성공 지표 (MVP)

- D7 리텐션 40%+ (Phase 8 d7-tracker 자동 측정)
- 일일 판매 입력률 60%+
- 주간 재고 실사 수행률 50%+

지표 미달 시 기능 추가보다 **입력 마찰 줄이기**부터 검토.

## 라이선스

Private — 무단 복제·배포 금지.
