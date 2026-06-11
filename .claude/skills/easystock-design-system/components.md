# 컴포넌트

이지스톡 디자인 시스템의 핵심 컴포넌트 사양. 모든 사이즈는 모바일 우선 (320~428px viewport).

---

## Card

기본 컨테이너. 흰 표면 + 얕은 그림자 + 얇은 보더 조합.

```tsx
<div className="bg-card rounded-2xl p-4 shadow-card" style={{ border: '1px solid var(--border)' }}>
  ...
</div>
```

**규칙**
- `padding: 16px` 기본. 컴팩트는 `14px`, 큰 카드는 `20px`
- `border-radius: 16~20px`
- 기본은 `shadow-card`, 강조는 `shadow-lift`
- 호버시 `var(--card-hover)` 또는 `border: var(--c-blue)` (선택 상태)

**변형**
- `interactive` — 호버 가능, cursor pointer
- `selected` — `border: 1px solid var(--c-blue)` + 연한 블루 배경

---

## Button

```tsx
// Primary — 가장 중요한 액션 (저장, 다음, 시작)
<button className="py-3 bg-blue text-white rounded-2xl font-semibold text-[14px] shadow-soft">저장하기</button>

// Secondary — 보조 액션 (등록, 추가)
<button className="py-3 bg-card text-ink-1 rounded-2xl font-semibold text-[13.5px] shadow-soft"
  style={{ border: '1px solid var(--border)' }}>매입 등록</button>

// Tertiary (Dashed) — 새 항목 추가
<button className="py-2.5 rounded-xl font-semibold text-[12.5px] text-ink-3"
  style={{ border: '1px dashed var(--border-strong)' }}>+ 품목 추가</button>

// Icon button (counter +/-)
<button className="w-7 h-7 rounded-lg flex items-center justify-center bg-ink-1 text-bg">
  <Icon name="plus" size={11} />
</button>
```

**규칙**
- 최소 hit target 44px (작은 아이콘 버튼은 padding으로 보완)
- Primary는 `bg-blue`, destructive만 red
- Secondary도 단순 보더 박스보다 `surface button`처럼 보여야 함
- 1차 CTA는 화면마다 1개만 가장 강하게

---

## Chip / Tag

상태 배지. 작고 압축적.

```tsx
// Chip — 카드 우상단 보조 정보 ("지난주 比 +12%")
<span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold"
  style={{ background: 'var(--c-green-soft)', color: 'var(--c-green-deep)' }}>
  +12%
</span>

// Tag — 마진율, 카테고리 등
<span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold num"
  style={{ background: 'var(--c-green-soft)', color: 'var(--c-green-deep)' }}>
  62%
</span>
```

**Tone 매핑** (절대 임의 변경 금지)
- `green` — 마진 50%+ / 안전 / 증가
- `amber` — 마진 30~49% / 주의 / 매입
- `red` — 마진 30% 미만 / 발주 필요 / 누락
- `blue` — 정보 / 토요일
- `neutral` — 의미 없음 / 단순 카운트

---

## Metric

숫자 + 단위 + 라벨 조합. 모든 통계 카드의 기본.

```tsx
<div>
  <div className="text-[10.5px] font-medium text-ink-3 mb-1">순수익</div>
  <div className="num text-[16px] font-bold text-ink-1">
    198,000<span className="text-[11px] text-ink-3 ml-0.5 font-semibold">원</span>
  </div>
</div>
```

**규칙**
- 라벨은 `ink-3` 색상, 위에 배치
- 숫자에 반드시 `num` 클래스 (tabular-nums)
- 단위(`원`, `%`, `잔`)는 숫자보다 `~30% 작게`, `ink-3` 색
- Hero 메트릭은 `tracking-tight` (`-0.02em`) 강제

---

## SectionLabel

화면 내 섹션 구분.

```tsx
<div className="flex items-baseline justify-between mb-2 mt-5">
  <span className="text-[12px] font-semibold text-ink-3">오늘 할 일</span>
  <span className="text-[11px] num text-ink-3">3</span>
</div>
```

**규칙**
- `font-size: 12px`, `font-weight: 600`, `color: ink-3`
- 우측 액션은 카운트나 "전체 →" 링크
- 섹션 타이틀에 아이콘 사용 금지

---

## Input

```tsx
<input className="w-full px-4 py-3 rounded-2xl bg-card text-[14px] font-medium outline-none text-ink-1 shadow-soft"
  style={{ border: '1px solid var(--border)' }} />
```

**규칙**
- 단위 표시는 `absolute` 우측 8~10px (`원`, `kg`, `일`)
- 숫자 입력은 `num` 클래스
- 포커스 시 보더는 `blue`, 배경은 더 밝게
- 폼 라벨은 항상 인풋 위, `text-ink-3 font-semibold`

---

## Counter

판매 입력 등에 쓰이는 +/- 카운터.

```tsx
<div className="flex items-center gap-1.5">
  <button className="w-7 h-7 rounded-lg" style={{ border: '1px solid var(--border)' }}>−</button>
  <span className="num w-8 text-center text-[16px] font-bold text-ink-1">12</span>
  <button className="w-7 h-7 rounded-lg bg-ink-1 text-bg">+</button>
</div>
```

**규칙**
- 0일 때 − 버튼 비활성 (`text-ink-4`)
- + 버튼은 항상 채워진 검정 (가장 자주 누름)
- 숫자는 큰 사이즈 (`16px+`), `tabular-nums`

---

## Alert Card

페이지 하단·중간의 경고/안내.

```tsx
<div className="rounded-xl p-3 flex items-start gap-2.5"
  style={{ background: 'var(--c-red-soft)' }}>
  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
    style={{ background: 'var(--c-red)', color: 'white' }}>
    <Icon name="alert" size={14} />
  </div>
  <div className="flex-1">
    <div className="text-[13px] font-semibold" style={{ color: 'var(--c-red-deep)' }}>
      딸기빙수 마진 18%로 하락
    </div>
    <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-red-deep)', opacity: 0.85 }}>
      딸기 단가 +40% 인상 영향 · 가격 조정 검토
    </div>
  </div>
</div>
```

**규칙**
- 배경은 status soft, 텍스트는 status deep
- 아이콘 컨테이너는 status main + 흰 아이콘
- 하위 설명은 `opacity: 0.85`로 위계

---

## Tab Bar (하단 네비게이션)

5탭 고정.

```
오늘 (home) · 캘린더 · 판매 · 메뉴 · 재료
```

**규칙**
- 높이 56~64px + safe-area-inset-bottom
- 활성 탭은 `text-ink-1`, 비활성은 `text-ink-3`
- 아이콘 + 라벨 (라벨 `10px 600`)
- 보더 상단 1px

---

## List Row

메뉴 목록, 베스트셀러 등.

```tsx
<div className="flex items-center px-3.5 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
  <span className="num text-[10.5px] font-semibold text-ink-3 w-5">1</span>
  <span className="text-[13.5px] font-semibold text-ink-1 flex-1">아메리카노</span>
  <span className="num text-[11px] text-ink-3 mr-3">95잔</span>
  <span className="num text-[14px] font-bold text-ink-1">71%</span>
</div>
```

**규칙**
- 행 높이 일정 (`py-2.5` = 10+10+텍스트)
- 마지막 행은 보더 없음
- 좌→우 위계: 순번 → 이름 → 메타 → 핵심값
- 핵심값(우측 끝)이 가장 굵음

---

## Progress Bar

재료 잔량 등.

```tsx
<div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
  <div className="h-full rounded-full" style={{ width: '40%', background: 'var(--c-amber)' }} />
</div>
```

**규칙**
- 높이 `1~4px` (얇게)
- 색상은 status에 매핑 (red/amber/green)
- 100% 초과 시 `width: 100%`로 클램프

---

## 아이콘 시스템

- 인라인 SVG, `currentColor` 사용
- 사이즈: `12, 14, 16, 18px`
- 스트로크: `1.75~2px` (얇은 라인 아이콘)
- 추천 라이브러리: **lucide-react** (`stroke-width: 1.75`)
- 사용하는 아이콘 (이지스톡 한정):
  `truck` (발주), `flame` (긴급), `pencil` (입력), `alert` (경고),
  `coin` (수익), `receipt` (매입), `up/down` (변동), `back/chev_r`,
  `plus/minus`, `close`, `cal` (캘린더)
