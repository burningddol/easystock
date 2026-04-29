<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0
Bump rationale: MINOR — Implementation Order에 calendar(월간 장부) 화면 신규 추가 (5개 → 6개), Design Source의 표준 참조 스킬을 easystock-design-system으로 지정 (항상 참조 의무)
Modified principles: (없음 — 이번 개정은 Development Workflow 변경)
Added sections:
  - Development Workflow > Implementation Order: 6번째 화면 calendar(P6) 추가, 하단 탭 5개 구조 명시(매입은 컨텍스트 진입)
  - Development Workflow > Design Source: 프로젝트 내 디자인 시스템 스킬 `.claude/skills/easystock-design-system` 항상 참조 의무 명시 (토큰/컴포넌트/패턴 단일 진실 공급원)
Removed sections: (없음)
Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check 런타임 참조, 정적 수정 불필요
  - ✅ .specify/templates/spec-template.md — 수정 불필요
  - ✅ .specify/templates/tasks-template.md — 수정 불필요
  - ⚠ CLAUDE.md (프로젝트 루트) — 디렉토리 구조에 calendar/ 추가, 디자인 워크플로우 표준 스킬 갱신 (별도 편집)
Follow-up TODOs: (없음)
스킬 상태: easystock-design-system 스킬은 .claude/skills/easystock-design-system/ 에 존재 확인됨 (SKILL.md, tokens.json, tokens.ts, components.md, patterns.md). 캘린더 패턴 포함.
-->

# 이지스톡 (EasyStock) Constitution

## Core Principles

### I. 입력 마찰이 1순위 KPI다 (NON-NEGOTIABLE)

모든 화면, 흐름, 알림은 페르소나 김지영(34세, 빙수카페 2년차)이 폰에서 1분~5분 안에 완료할 수 있는가로 검증해야 한다. 입력이 끊기면 모든 가치가 무너진다. 신규 기능 제안 시에는 입력 단계 수와 예상 소요 시간을 spec에 명시 MUST 하며, 기능 추가보다 입력 마찰 감소가 우선한다.

**Rationale**: 페르소나에서 가장 강하게 드러난 패턴은 "5분 안에 가치를 못 느끼면 이탈"이다. 성공 지표(D7 리텐션, 일일 입력률)는 모두 입력 지속이 전제다.

### II. 모바일·PWA 우선

사장님은 폰에서 사용한다. 데스크탑은 부가 채널이며, 모든 신규 화면은 모바일 레이아웃을 먼저 구현하고 데스크탑은 반응형으로 확장한다. 핵심 알림(재료 소진)은 PWA 푸시로 전달한다. iOS PWA 푸시 제약(홈 화면 추가 필수, iOS 16.4+) 안내는 온보딩 플로우에 반드시 포함되어야 한다.

**Rationale**: 페르소나의 사용 시점(아침 오픈 전 1분 체크, 마감 후 5분)과 디바이스 사용 패턴(스마트폰 능숙)이 일치하는 채널은 모바일이다. 네이티브 앱은 1차 MVP에서 과도하다.

### III. 마진은 "재료 원가 기준"으로만 표시한다 (NON-NEGOTIABLE)

마진 = 매출 − 재료원가. 임대료, 인건비, 기타 고정비는 이 계산에 절대 포함하지 않는다. UI에서 마진/순수익/마진율을 표시하는 모든 지점에 "재료 원가 기준 (이동평균법)"이라는 표기를 함께 노출 MUST. 이 표기 누락은 출시 차단 사유다.

**단가 산정 (NON-NEGOTIABLE)**:

- 재료 단가는 **가중 이동 평균법**으로 산정 MUST. 매입할 때마다 새 평균 단가를 산출한다:
  `새 평균 = (현재 재고 × 현재 평균 + 신규 수량 × 신규 단가) ÷ (현재 재고 + 신규 수량)`
- 판매 시점의 메뉴 원가(레시피 × 각 재료 평균 단가)는 Sale 레코드에 **스냅샷으로 함께 저장 MUST**. 한 번 저장된 과거 매출의 마진은 시간이 지나도 변하지 않는다 (역사적 마진 보존).
- 재고 실사는 수량 보정용이며 평균 단가를 변경하지 않는다.
- 첫 매입 시(이전 재고 0) 신규 단가가 그대로 평균 단가가 된다.
- "최신 단가만 사용", "기간 단순 평균" 등으로의 단순화는 금지한다.

**Rationale**: 페르소나가 "통장에 돈이 없다"고 말하는 것은 고정비 영향이지만, MVP는 변동비(재료비)만 다룬다. 표기 누락 시 사장님이 잘못된 의사결정을 하게 된다. 단가는 매일 변하므로 판매 시점 단가를 보존하지 않으면 과거 마진이 오늘 단가로 재계산되어 매일 숫자가 바뀐다 — 신뢰가 즉시 무너진다. 이동평균법은 한국 세무회계 표준이라 후속 세무 신고에서도 일관성을 유지한다.

### IV. 데이터는 user_id RLS로 격리한다 (NON-NEGOTIABLE)

모든 Supabase 테이블은 Row Level Security 정책으로 `user_id` 기반 격리되어야 한다. 1인 가게 전제지만 멀티테넌시 모델을 처음부터 깔아둔다. RLS 정책이 없는 테이블은 PR 머지를 차단한다. 인덱스, 마이그레이션, 새 컬럼 추가 시에도 RLS 영향도를 함께 검토한다.

**Rationale**: 사후 RLS 추가는 데이터 마이그레이션과 정책 충돌 검증 비용이 크다. 처음부터 정책으로 박아두면 이후 직원 권한관리 같은 확장이 단순한 정책 변경으로 끝난다.

### V. 스코프 가드: 명시 요청 없이는 추가하지 않는다 (NON-NEGOTIABLE)

다음 항목은 사용자 명시 요청이 없는 한 specify, plan, tasks, implement 어느 단계에서도 자발적으로 추가하지 않는다:

- 임대료/인건비를 포함한 순이익 계산
- OCR 영수증 인식
- POS 연동
- 자동 발주 메시지 발송 (1차 MVP는 수동 복사)
- 직원 권한관리, 근태, 인건비 자동 계산
- 계절성 자동 보정 (1년 데이터 누적 후 재논의)

`/speckit-specify` 단계에서 위 항목을 요구하는 입력이 들어오면 거부하고 사용자 확인을 요청 MUST 한다.

**Rationale**: MVP는 검증 가능한 가설에 집중해야 한다. 위 기능들은 모두 가치 있지만 입력 마찰을 늘리거나 1차 가설 검증을 흐린다.

### VI. 명확성 우선, `any` 금지, guard clause 우선

글로벌 시니어 룰(`~/.claude/CLAUDE.md`)을 프로젝트 전반에 적용한다. 구체 규칙:

- TypeScript strict 모드, `any` 사용 금지 (`unknown` 또는 정확한 타입 사용)
- 최상위 함수에 명시적 반환 타입 선언
- 함수는 단일 책임 — 복잡 로직은 헬퍼로 추출
- 명백한 코드를 설명하는 주석 금지, "왜" 주석만 허용 (단, 최후 수단)
- 중첩 깊이 최대 2단계, guard clause로 early return
- 불리언 변수는 `is`/`has`/`can` 접두사
- 이벤트 핸들러는 `handle` 접두사

위반은 코드 리뷰에서 차단 SHOULD 한다.

**Rationale**: 소규모 팀 개발에서 일관성은 인지 비용을 직접적으로 줄인다. 규칙은 합의되어 있을 때만 가치가 있으므로 헌법에 박아둔다.

### VII. 검증 가능한 가설로 출시한다

다음 지표를 측정 MUST 한다:

- D7 리텐션 40% 이상
- 일일 판매 입력률 60% 이상 (가입자 중 매일 입력하는 비율)
- 주간 재고 실사 수행률 50% 이상
- 월 1회 NPS 측정, 7점 이상 추천 의향 비율 추적

지표 미달 시 기능 추가가 아니라 **입력 마찰 점검**부터 한다.

**Rationale**: "어차피 엑셀에 입력하던 것"을 우리에게 입력하게 만드는 것이 핵심 가설이다. 입력이 끊기면 마진/예측 같은 후속 가치가 모두 0이 된다.

## Technology Constraints

확정된 기술 결정 (변경 시 MINOR 이상 버전 업):

- **Frontend**: Next.js 15 (App Router) + PWA, Tailwind CSS, shadcn/ui
- **State**: TanStack Query (서버 상태) + Zustand (클라이언트 폼 임시저장)
- **Forms/Validation**: React Hook Form + Zod (Zod 스키마는 타입과 런타임 검증의 단일 진실 공급원)
- **Backend**: Supabase (Auth + Postgres + Realtime + Storage + RLS)
- **Charts**: Recharts / **Date**: date-fns (ko locale)
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)
- **Language**: TypeScript strict 모드, `any` 금지, 명시적 반환 타입

## Development Workflow

### Spec-Driven Development (SDD)

본 프로젝트는 GitHub Spec Kit 기반 SDD 흐름으로 진행한다:

1. `/speckit-constitution` — 본 헌법 (현재 단계 완료)
2. `/speckit-specify` — feature 명세 작성 (요구사항, 사용자 스토리)
3. `/speckit-clarify` — 명세의 모호한 부분 명료화 (선택)
4. `/speckit-plan` — 기술 구현 계획 + Constitution Check 통과
5. `/speckit-tasks` — 사용자 스토리 단위 task 분해
6. `/speckit-implement` — Phase 단위 실행

### Implementation Order

6개 화면 우선순위 (페르소나 사용 빈도 기준):

1. **sale** — 판매 일괄 입력 (매일 사용, 입력 진입점)
2. **purchase** — 매입 등록 (재료 단가 추적의 시작; 거래명세서 받을 때만 사용 — 하단 탭이 아닌 컨텍스트 진입)
3. **menu** — 메뉴/레시피 (마진 계산의 기반)
4. **inventory** — 재고/소진 예측 (핵심 가치 제공 지점)
5. **dashboard (오늘)** — 홈 (알림, 오늘 요약)
6. **calendar (월간 장부)** — 월간 매출·매입·누락일 한눈에 보고, 셀 클릭으로 소급 입력 진입

하단 탭은 5개(오늘, 캘린더, 판매, 메뉴, 재료). 매입은 빈도가 낮아 컨텍스트 진입(예: 재료 화면 또는 빠른 액션)으로 처리한다.

### Code Organization

`src/features/{도메인}/` 구조로 도메인 분리. 공용 UI 원자만 `src/components/ui/`에 둔다. 도메인 로직은 도메인 폴더 안에서 캡슐화한다.

### Phase Validation

각 Phase 완료 후 로컬 환경에서 동작 검증을 거친 뒤 다음 Phase에 진입한다. 타입 체크와 빌드는 자동으로 통과해야 하며, 핵심 사용자 흐름(가입 → 판매 입력 → 마감 후 마진 확인)은 수동 검증 MUST.

### Design Source

UI/UX는 프로젝트 내 디자인 시스템 스킬 **`.claude/skills/easystock-design-system`을 항상 참조 MUST**한다. 모든 화면 구현, plan 작성, implement 단계는 이 스킬의 토큰(`tokens.json`/`tokens.ts`), 컴포넌트 사양(`components.md`), 화면 패턴(`patterns.md`)을 단일 진실 공급원으로 삼는다.

원칙:

- 디자인 토큰 하드코딩 금지. 색·spacing·radius·typography는 스킬의 토큰을 import해서 사용한다.
- 화면 신규 추가 시 우선 `patterns.md`에서 해당 화면 패턴을 찾고, 없으면 스킬에 패턴을 추가한 뒤 구현 (스킬이 코드보다 먼저 갱신).
- 폰트는 Pretendard 단일. 시스템 폰트·Google Fonts 사용 금지.
- 그림자 금지, 보더와 배경 대비로만 위계 표현.
- 보조 스킬(`frontend-ui-ux-engineer` 등)은 새 패턴 탐색용으로만 사용하고, 산출물은 반드시 `easystock-design-system`에 통합한 후 사용한다.

별도 디자인 도구(Figma 등) 의존 없이 코드 우선 워크플로우를 유지한다. 모든 디자인은 헌법 II(모바일·PWA 우선)와 I(입력 마찰 1순위)에 부합 MUST.

## Governance

### Authority

본 헌법은 임의 결정에 우선한다. `/speckit-plan` 단계마다 Constitution Check를 수행하며, 위반이 발견되면 plan 작성을 중단하고 다음 중 하나를 택한다:

1. 설계를 헌법에 맞게 수정
2. 헌법 개정 (정당화 + 버전 bump)

### Amendment Procedure

개정은 다음 절차를 따른다 MUST:

- 변경 사유 기록 (commit message 또는 별도 문서)
- Semantic version bump:
  - **MAJOR**: 원칙의 제거 또는 backward-incompatible 재정의
  - **MINOR**: 새 원칙/섹션 추가 또는 가이드의 실질적 확장
  - **PATCH**: 명확화, 표현 개선, 오타 수정
- 의존 템플릿(`plan-template.md`, `spec-template.md`, `tasks-template.md`, 존재 시 `commands/*.md`) 동기화 검토
- `LAST_AMENDED_DATE` 갱신

### Conflict Resolution

글로벌 `~/.claude/CLAUDE.md` 시니어 룰과 본 헌법이 충돌하면 글로벌이 우선한다. 본 헌법은 글로벌 룰 위에 프로젝트 도메인 제약을 얹는 역할이다.

### Compliance Review

`/speckit-plan` 단계의 Constitution Check가 1차 검증, 코드 리뷰가 2차 검증이다. NON-NEGOTIABLE 원칙(I, III, IV, V) 위반은 머지 차단 사유다.

**Version**: 1.2.0 | **Ratified**: 2026-04-30 | **Last Amended**: 2026-04-30
