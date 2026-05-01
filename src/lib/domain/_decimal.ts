import DecimalBase from "decimal.js";

/**
 * 도메인 전용 Decimal 인스턴스.
 *
 * `Decimal.set()`을 글로벌에 호출하면 다른 모듈 또는 라이브러리가 같은
 * Decimal에 의존할 때 silent하게 영향받음. `clone()`으로 우리 도메인 전용
 * 인스턴스를 분리하고, 도메인 모듈은 모두 여기서 import.
 *
 * Precision 28: SC-009의 30일 누적 ≤0.01원 요구를 충분히 만족하면서 (decimal.js
 * 내부 곱셈/나눗셈 라운딩 헤드룸) 일반 거래 단위(numeric(12,4)) 변환에 불필요
 * 하게 큰 메모리를 안 씀. 28은 decimal.js 기본값.
 */
const DOMAIN_DECIMAL_PRECISION = 28;

export const Decimal = DecimalBase.clone({
  precision: DOMAIN_DECIMAL_PRECISION,
  rounding: DecimalBase.ROUND_HALF_UP,
});

export type Decimal = InstanceType<typeof Decimal>;
