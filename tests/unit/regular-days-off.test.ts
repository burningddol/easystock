import { describe, it, expect } from "vitest";
import {
  applyChangeSnapshot,
  excludeFromAverage,
  isMissingDay,
  isRegularDayOff,
  weekdayOf,
  type DailySample,
  type Weekday,
} from "@/lib/domain/regular-days-off";

const monday = new Date("2026-04-27T00:00:00");
const tuesday = new Date("2026-04-28T00:00:00");
const wednesday = new Date("2026-04-29T00:00:00");
const sunday = new Date("2026-05-03T00:00:00");

describe("weekdayOf", () => {
  it("월요일을 MON으로 매핑한다", () => {
    expect(weekdayOf(monday)).toBe("MON");
  });

  it("일요일을 SUN으로 매핑한다", () => {
    expect(weekdayOf(sunday)).toBe("SUN");
  });
});

describe("isRegularDayOff", () => {
  it("정기휴무에 포함된 요일은 true", () => {
    expect(isRegularDayOff(monday, ["MON"])).toBe(true);
  });

  it("포함되지 않은 요일은 false", () => {
    expect(isRegularDayOff(tuesday, ["MON"])).toBe(false);
  });

  it("빈 배열이면 항상 false (365일 영업)", () => {
    expect(isRegularDayOff(monday, [])).toBe(false);
  });
});

describe("excludeFromAverage (FR-042 + FR-045)", () => {
  const samples: DailySample[] = [
    { date: monday, hasSale: false, value: 0 },
    { date: tuesday, hasSale: true, value: 50 },
    { date: wednesday, hasSale: true, value: 60 },
  ];

  it("정기휴무 요일은 평균 산정에서 제외", () => {
    const result = excludeFromAverage(samples, ["MON"]);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.value)).toEqual([50, 60]);
  });

  it("정기휴무 요일이라도 Sale이 입력된 날은 예외 영업으로 포함 (FR-045)", () => {
    const withException: DailySample[] = [
      { date: monday, hasSale: true, value: 30 }, // 정기휴무지만 영업함
      ...samples.slice(1),
    ];
    const result = excludeFromAverage(withException, ["MON"]);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.value)).toContain(30);
  });
});

describe("isMissingDay (FR-041)", () => {
  it("영업일에 Sale 없으면 누락", () => {
    const sample: DailySample = { date: tuesday, hasSale: false, value: 0 };
    expect(isMissingDay(sample, ["MON"])).toBe(true);
  });

  it("정기휴무 요일은 누락이 아니다", () => {
    const sample: DailySample = { date: monday, hasSale: false, value: 0 };
    expect(isMissingDay(sample, ["MON"])).toBe(false);
  });

  it("정기휴무여도 Sale이 있으면 누락 아님 (영업일 인식)", () => {
    const sample: DailySample = { date: monday, hasSale: true, value: 30 };
    expect(isMissingDay(sample, ["MON"])).toBe(false);
  });

  it("Sale이 있으면 정기휴무 여부와 무관하게 누락 아님", () => {
    const sample: DailySample = { date: tuesday, hasSale: true, value: 50 };
    expect(isMissingDay(sample, ["MON"])).toBe(false);
  });
});

describe("applyChangeSnapshot (FR-044)", () => {
  const changes = [
    { effectiveFrom: new Date("2026-01-01"), daysOff: [] as Weekday[] },
    { effectiveFrom: new Date("2026-03-01"), daysOff: ["MON"] as Weekday[] },
    { effectiveFrom: new Date("2026-04-15"), daysOff: ["MON", "TUE"] as Weekday[] },
  ];

  it("변경 이전 날짜는 빈 배열을 반환한다 (가입 직후 등)", () => {
    const earlier = new Date("2025-12-31");
    expect(applyChangeSnapshot(earlier, changes)).toEqual([]);
  });

  it("첫 변경 시점 날짜는 첫 변경의 규칙을 적용한다", () => {
    const date = new Date("2026-01-01");
    expect(applyChangeSnapshot(date, changes)).toEqual([]);
  });

  it("중간 변경 후 날짜는 그 변경의 규칙을 적용 (이전 휴무는 영향 없음)", () => {
    const date = new Date("2026-03-15");
    expect(applyChangeSnapshot(date, changes)).toEqual(["MON"]);
  });

  it("최신 변경 이후는 최신 규칙 적용", () => {
    const date = new Date("2026-04-30");
    expect(applyChangeSnapshot(date, changes)).toEqual(["MON", "TUE"]);
  });

  it("changes가 비어 있으면 빈 배열", () => {
    expect(applyChangeSnapshot(monday, [])).toEqual([]);
  });
});
