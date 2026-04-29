---
name: easystock-design-system
description: 이지스톡(EasyStock) 카페/빙수 자영업자용 재고·원가 관리 서비스의 디자인 시스템. 한국어 모바일 우선 디자인 토큰, 컴포넌트 패턴, 화면별 레이아웃 가이드.
---

# 이지스톡 디자인 시스템

> 카페/빙수집 사장님을 위한 재고·원가 관리 서비스의 모바일 디자인 시스템.
> 페르소나: 34세 빙수카페 2년차 사장님. 엑셀 합계 함수 정도, 스마트폰 앱은 능숙.

## 디자인 원칙

1. **숫자가 주인공** — 매출/마진/원가가 가장 큰 시각 요소. 항상 `tabular-nums`로 자릿수 흔들림 방지.
2. **카드 + 보더 위계** — 그림자 사용 금지. 보더(`#e8e5db`)와 배경 대비로만 위계 표현.
3. **알림 = 사장님이 뭘 해야 하는가** — 정보가 아니라 액션. 항상 화면 상단.
4. **요일 비교** — 매출 비교는 항상 "지난주 같은 요일" 기준 (전일 비교 금지). 요일 패턴이 강한 업종.
5. **단위는 작게, 숫자는 크게** — `582,000원`에서 "원"은 보조색·작은 사이즈로.
6. **5분 가치 증명** — 가입 후 5분 안에 가치 못 느끼면 이탈. 콜드스타트는 템플릿으로.

## 파일 구성

- `SKILL.md` — 지금 보는 이 파일 (개요)
- `tokens.json` — 디자인 토큰 (color, spacing, radius, typography)
- `tokens.ts` — TypeScript용 토큰 (Tailwind/styled-components 직접 import 가능)
- `components.md` — 컴포넌트 사양 (Card, Button, Chip, Tag, Metric 등)
- `patterns.md` — 화면별 레이아웃 패턴 (홈, 캘린더, 판매 입력 등 6개 화면)

## 사용법 (Claude Code)

```
@.claude/skills/easystock-design-system/SKILL.md 를 읽고
이 디자인 시스템대로 [화면명]을 구현해줘.
```

또는 토큰만 필요하면:
```
@.claude/skills/easystock-design-system/tokens.ts 를 import해서 사용
```

## 기술 스택 권장

- **웹**: Next.js 14 + Tailwind + Pretendard
- **모바일**: Expo + NativeWind + Pretendard
- 둘 다 토큰을 그대로 사용 가능

## 폰트

**Pretendard 단일.** Google Fonts나 시스템 폰트 사용 금지.

```html
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet" />
```

```css
font-family: 'Pretendard', ui-sans-serif, system-ui, sans-serif;
```

## 다크 모드

CSS 변수 기반으로 자동 전환. `:root` 와 `.dark-mode` 클래스 두 세트만 정의.
구체적 값은 `tokens.json` 참조.
