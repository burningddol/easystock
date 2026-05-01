# Lighthouse 검증 (T171)

`/sale` 라우트에서 PWA / Accessibility / Performance / Best Practices ≥ 90 검증. CI 게이트 아닌 출시 직전 일회성 베이스라인 + 회귀 발생 시 재실행.

## 한 번 실행

### 1. 프로덕션 빌드 + 프리뷰 서버

```bash
npm run build
npm run start
```

`http://localhost:3000` 에 프로덕션 번들 띄우기 (dev server는 hot-reload 영향으로 점수 부정확).

### 2. 별도 터미널에서 Lighthouse

```bash
npx --yes lighthouse@latest http://localhost:3000/sale \
  --preset=desktop \
  --form-factor=mobile \
  --screenEmulation.mobile=true \
  --screenEmulation.width=375 \
  --screenEmulation.height=667 \
  --screenEmulation.deviceScaleFactor=2 \
  --only-categories=performance,accessibility,best-practices,pwa \
  --output=html \
  --output-path=./lighthouse-sale.html \
  --chrome-flags="--headless"
```

브라우저로 `lighthouse-sale.html` 열어 4 카테고리 모두 ≥ 90 확인.

> **로그인 게이트**: `/sale`은 인증 필요 → Lighthouse가 로그인 화면을 측정하게 됨. 실제 페르소나 흐름 측정이 필요하면 사전에 브라우저로 로그인하고 `--extra-headers='{"Cookie":"..."}'` 또는 storage state json을 전달.

## 임계 미달 시

| 카테고리       | 흔한 원인                                                                      |
| -------------- | ------------------------------------------------------------------------------ |
| Performance    | 큰 이미지 / 폰트 FOUT / 큰 JS 번들 (next-bundle-analyzer로 재료 식별)          |
| Accessibility  | 색 대비 (디자인 토큰 ink-3 on bg 확인) / 미스매치 라벨 / aria 누락             |
| PWA            | manifest.ts theme_color / icon 사이즈 / start_url / serviceWorker registration |
| Best Practices | 콘솔 에러 / `<img>` aspect ratio / mixed content                               |

## CI 통합 (선택, 베타 후 결정)

`@lhci/cli` + `lighthouserc.cjs` 으로 자동화 가능. 단, dev/preview server를 CI에서 띄우는 비용 + 점수 변동성으로 게이트 부적합 → **회귀 알림용 PR 코멘트** 정도가 적절. 베타 트래픽으로 Web Vitals 실측 시작 후 도입 권장.
