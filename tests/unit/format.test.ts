import { describe, it, expect } from "vitest";
import {
  daysUntilDate,
  formatDateKoFromIso,
  formatNumber,
  formatTodayKo,
  formatWon,
  localIsoDate,
  parseLocalDateFromIso,
  weekdayKoFromIso,
} from "@/lib/utils/format";

describe("formatWon", () => {
  it("천 단위 콤마 + 반올림", () => {
    expect(formatWon(1234567)).toBe("1,234,567");
    expect(formatWon(99.6)).toBe("100");
    expect(formatWon(0)).toBe("0");
  });
});

describe("formatNumber", () => {
  it("천 단위 콤마, 소수점 보존", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(12.5)).toBe("12.5");
  });
});

describe("localIsoDate", () => {
  it("로컬 tz 기준 YYYY-MM-DD (toISOString UTC와 다를 수 있음)", () => {
    const date = new Date(2026, 4, 1, 23, 30); // 로컬 2026-05-01 23:30
    expect(localIsoDate(date)).toBe("2026-05-01");
  });

  it("월/일 zero-pad", () => {
    const date = new Date(2026, 0, 5);
    expect(localIsoDate(date)).toBe("2026-01-05");
  });
});

describe("parseLocalDateFromIso", () => {
  it("YYYY-MM-DD를 로컬 0시 Date로", () => {
    const date = parseLocalDateFromIso("2026-04-15");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(3);
    expect(date!.getDate()).toBe(15);
  });

  it("malformed 문자열은 null", () => {
    expect(parseLocalDateFromIso("")).toBeNull();
    expect(parseLocalDateFromIso("not-a-date")).toBeNull();
  });
});

describe("weekdayKoFromIso", () => {
  it("ISO 날짜를 한국어 한 글자 요일로", () => {
    // 2026-05-01은 금요일
    expect(weekdayKoFromIso("2026-05-01")).toBe("금");
    // 2026-05-03은 일요일
    expect(weekdayKoFromIso("2026-05-03")).toBe("일");
  });

  it("malformed 문자열은 빈 문자열", () => {
    expect(weekdayKoFromIso("")).toBe("");
  });
});

describe("formatTodayKo", () => {
  it("M월 D일 (요일) 형식", () => {
    const date = new Date(2026, 4, 1); // 2026-05-01 (금)
    expect(formatTodayKo(date)).toBe("5월 1일 (금)");
  });
});

describe("formatDateKoFromIso", () => {
  it("ISO 문자열 → M월 D일 (요일)", () => {
    expect(formatDateKoFromIso("2026-05-01")).toBe("5월 1일 (금)");
  });

  it("malformed면 원문 반환", () => {
    expect(formatDateKoFromIso("invalid")).toBe("invalid");
  });
});

describe("daysUntilDate", () => {
  it("캘린더 일수 차이 (시계 시각 무관)", () => {
    const now = new Date(2026, 4, 1, 23, 59);
    const target = new Date(2026, 4, 5, 0, 1); // 4일 후
    expect(daysUntilDate(target, now)).toBe(4);
  });

  it("같은 날짜 다른 시각도 0", () => {
    const now = new Date(2026, 4, 1, 0, 0);
    const target = new Date(2026, 4, 1, 23, 59);
    expect(daysUntilDate(target, now)).toBe(0);
  });

  it("과거 날짜는 0으로 클램프 (소진 임박/만료 무관)", () => {
    const now = new Date(2026, 4, 5);
    const target = new Date(2026, 4, 1);
    expect(daysUntilDate(target, now)).toBe(0);
  });

  it("null target은 null", () => {
    expect(daysUntilDate(null)).toBeNull();
  });
});
