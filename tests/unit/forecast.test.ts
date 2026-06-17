import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/domain/_decimal";
import {
  businessDayTypeOf,
  classifyStatus,
  computeBusinessDayUsageModel,
  computeTrendFactor,
  computeWeekdayUsageAverage,
  detectTrend,
  forecastIngredient,
  forecastMenuDemand,
  isColdStart,
  predictDepletionDate,
  type DailyConsumption,
  type DailyMenuDemand,
} from "@/lib/domain/forecast";

const ONE_DAY = 24 * 60 * 60 * 1000;
const today = new Date("2026-04-30T00:00:00");

function daysAgo(days: number): Date {
  return new Date(today.getTime() - days * ONE_DAY);
}

function usageModel(amount: number) {
  const usageByDayType = new Map([
    ["weekday", new Decimal(amount)],
    ["friday", new Decimal(amount)],
    ["weekend", new Decimal(amount)],
  ] as const);
  return {
    usageByDayType,
    fallbackDailyUsage: new Decimal(amount),
  };
}

describe("isColdStart (FR-018)", () => {
  it("가입 후 7일 미만은 콜드스타트", () => {
    expect(isColdStart(daysAgo(6), today)).toBe(true);
  });

  it("가입 후 정확히 7일은 콜드스타트 아님 (만 7일 데이터 누적 가정)", () => {
    expect(isColdStart(daysAgo(7), today)).toBe(false);
  });

  it("가입 30일 후는 일반", () => {
    expect(isColdStart(daysAgo(30), today)).toBe(false);
  });
});

describe("business day usage model", () => {
  it("월~목은 weekday, 금요일은 friday, 토/일은 weekend로 분류", () => {
    expect(businessDayTypeOf(new Date("2026-04-27"), [])).toBe("weekday");
    expect(businessDayTypeOf(new Date("2026-05-01"), [])).toBe("friday");
    expect(businessDayTypeOf(new Date("2026-05-02"), [])).toBe("weekend");
  });

  it("정기휴무는 예측 소비일에서 제외", () => {
    expect(businessDayTypeOf(new Date("2026-04-27"), ["MON"])).toBeNull();
  });

  it("최근 sample에 더 큰 가중치를 준다", () => {
    const model = computeBusinessDayUsageModel(
      [
        { date: daysAgo(80), amount: 10 },
        { date: daysAgo(60), amount: 10 },
        { date: daysAgo(3), amount: 100 },
        { date: daysAgo(1), amount: 100 },
      ],
      [],
      today,
    );

    expect(model.fallbackDailyUsage.toNumber()).toBeGreaterThan(80);
  });

  it("그룹 표본이 적으면 전체 영업일 평균과 섞어 안정화한다", () => {
    const samples: DailyConsumption[] = [
      { date: new Date("2026-04-03"), amount: 100 },
      { date: new Date("2026-04-06"), amount: 10 },
      { date: new Date("2026-04-07"), amount: 10 },
      { date: new Date("2026-04-08"), amount: 10 },
      { date: new Date("2026-04-09"), amount: 10 },
    ];

    const model = computeBusinessDayUsageModel(samples, [], today);

    expect(model.usageByDayType.get("friday")?.toNumber()).toBeLessThan(100);
    expect(model.usageByDayType.get("friday")?.toNumber()).toBeGreaterThan(10);
  });
});

describe("computeWeekdayUsageAverage", () => {
  it("같은 요일 sample들의 평균", () => {
    // 월요일(2026-04-27) 여러 개
    const samples: DailyConsumption[] = [
      { date: new Date("2026-04-27"), amount: 10 }, // 월
      { date: new Date("2026-04-20"), amount: 20 }, // 월
      { date: new Date("2026-04-13"), amount: 30 }, // 월
    ];
    const avg = computeWeekdayUsageAverage(samples, []);
    expect(avg.get("MON")?.toString()).toBe("20");
  });

  it("정기휴무 요일은 평균 산정에서 제외 (FR-042)", () => {
    const samples: DailyConsumption[] = [
      { date: new Date("2026-04-27"), amount: 100 }, // 월
      { date: new Date("2026-04-28"), amount: 50 }, // 화 (정기휴무)
      { date: new Date("2026-04-29"), amount: 80 }, // 수
    ];
    const avg = computeWeekdayUsageAverage(samples, ["TUE"]);
    expect(avg.has("TUE")).toBe(false);
    expect(avg.get("MON")?.toString()).toBe("100");
    expect(avg.get("WED")?.toString()).toBe("80");
  });

  it("샘플 비어있으면 빈 Map", () => {
    expect(computeWeekdayUsageAverage([], []).size).toBe(0);
  });
});

describe("predictDepletionDate", () => {
  it("재고 100, 매일 10g 소비 → 11일 뒤 소진", () => {
    const result = predictDepletionDate({
      currentStock: 100,
      usageModel: usageModel(10),
      today,
      daysOff: [],
    });
    expect(result).not.toBeNull();
    // 시작 다음 날부터 -10씩, 10일째에 0 도달
    const expected = new Date(today.getTime() + 10 * ONE_DAY);
    expect(result?.toDateString()).toBe(expected.toDateString());
  });

  it("정기휴무는 소비 0 (재고 보존)", () => {
    // 오늘 목(2026-04-30), 매일 50g, stock 250g.
    // daysOff 없음: 금(200) → 토(150) → 일(100) → 월(50) → 화(0) = 5일째 화요일 소진
    // SUN off: 금(200) → 토(150) → 일(skip) → 월(100) → 화(50) → 수(0) = 6일째 수요일 소진
    const noSundayResult = predictDepletionDate({
      currentStock: 250,
      usageModel: usageModel(50),
      today,
      daysOff: ["SUN"],
    });
    const allDaysResult = predictDepletionDate({
      currentStock: 250,
      usageModel: usageModel(50),
      today,
      daysOff: [],
    });
    expect(noSundayResult!.getTime()).toBeGreaterThan(allDaysResult!.getTime());
  });

  it("예측 1년 내 소진 안 하면 null", () => {
    const result = predictDepletionDate({
      currentStock: 1_000_000,
      usageModel: {
        usageByDayType: new Map([["weekday", new Decimal(0.001)]] as const),
        fallbackDailyUsage: new Decimal(0.001),
      },
      today,
      daysOff: [],
    });
    expect(result).toBeNull();
  });

  it("데이터 없는 영업일 타입은 전체 영업일 평균으로 대체 — over-forecast 방지", () => {
    const withFallback = predictDepletionDate({
      currentStock: 100,
      usageModel: {
        usageByDayType: new Map([["weekday", new Decimal(10)]] as const),
        fallbackDailyUsage: new Decimal(10),
      },
      today,
      daysOff: [],
    });
    expect(withFallback).not.toBeNull();
    const daysUntilDepletion = Math.round((withFallback!.getTime() - today.getTime()) / ONE_DAY);
    expect(daysUntilDepletion).toBeLessThanOrEqual(11);
  });

  it("usageModel 비어있으면 소진 예측 불가 (null)", () => {
    const result = predictDepletionDate({
      currentStock: 100,
      usageModel: {
        usageByDayType: new Map(),
        fallbackDailyUsage: new Decimal(0),
      },
      today,
      daysOff: [],
    });
    expect(result).toBeNull();
  });

  it("최근 추세 계수를 소진일 계산에 반영한다", () => {
    const normal = predictDepletionDate({
      currentStock: 100,
      usageModel: usageModel(10),
      trendFactor: 1,
      today,
      daysOff: [],
    });
    const rising = predictDepletionDate({
      currentStock: 100,
      usageModel: usageModel(10),
      trendFactor: 1.25,
      today,
      daysOff: [],
    });

    expect(rising!.getTime()).toBeLessThan(normal!.getTime());
  });
});

describe("classifyStatus (FR-013)", () => {
  it("데이터 부족(depletionDate=null) → safe", () => {
    expect(classifyStatus(null, 1, 1, today)).toBe("safe");
  });

  it("buffer ≤ 1 → critical", () => {
    // 소진 1일 후, 리드타임 0, 안전여유 1 → buffer = 0 → critical
    const date = new Date(today.getTime() + 1 * ONE_DAY);
    expect(classifyStatus(date, 0, 1, today)).toBe("critical");
  });

  it("buffer == 2 → order_needed", () => {
    // 소진 4일 후, 리드타임 1, 안전여유 1 → buffer = 2 → order_needed
    const date = new Date(today.getTime() + 4 * ONE_DAY);
    expect(classifyStatus(date, 1, 1, today)).toBe("order_needed");
  });

  it("buffer 3~4 → caution", () => {
    // 소진 6일 후, 리드타임 1, 안전여유 1 → buffer = 4 → caution
    const date = new Date(today.getTime() + 6 * ONE_DAY);
    expect(classifyStatus(date, 1, 1, today)).toBe("caution");
  });

  it("buffer ≥ 5 → safe", () => {
    const date = new Date(today.getTime() + 10 * ONE_DAY);
    expect(classifyStatus(date, 1, 1, today)).toBe("safe");
  });

  it("리드타임 긴 거래처는 더 빨리 critical", () => {
    // 소진 5일 후, 리드타임 5 → buffer = -1 → critical
    const date = new Date(today.getTime() + 5 * ONE_DAY);
    expect(classifyStatus(date, 5, 1, today)).toBe("critical");
  });

  it("안전여유일이 커질수록 더 빨리 위험 단계로 간다", () => {
    const date = new Date(today.getTime() + 6 * ONE_DAY);
    expect(classifyStatus(date, 1, 1, today)).toBe("caution");
    expect(classifyStatus(date, 1, 3, today)).toBe("order_needed");
  });
});

describe("detectTrend (FR-025)", () => {
  it("7일 평균 = 30일 평균 → normal", () => {
    const samples: DailyConsumption[] = Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(i + 1),
      amount: 100,
    }));
    expect(detectTrend(samples, today)).toBe("normal");
  });

  it("최근 7일이 30일 평균보다 +20% 초과 → rising", () => {
    const samples: DailyConsumption[] = Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(i + 1),
      // 최근 7일은 200, 그 이후 23일은 100 → 30일 평균 = (7*200 + 23*100) / 30 = 123.3
      // 7일 평균 = 200, ratio = 200/123.3 = 1.62 → rising
      amount: i < 7 ? 200 : 100,
    }));
    expect(detectTrend(samples, today)).toBe("rising");
  });

  it("최근 7일이 30일 평균보다 -20% 초과 → falling", () => {
    const samples: DailyConsumption[] = Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(i + 1),
      amount: i < 7 ? 50 : 100,
    }));
    expect(detectTrend(samples, today)).toBe("falling");
  });

  it("데이터 부족(빈 배열) → normal", () => {
    expect(detectTrend([], today)).toBe("normal");
  });
});

describe("computeTrendFactor", () => {
  it("최근 급증 추세는 상한 1.25로 제한", () => {
    const samples: DailyConsumption[] = Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(i + 1),
      amount: i < 7 ? 500 : 10,
    }));
    expect(computeTrendFactor(samples, today)).toBe(1.25);
  });

  it("최근 급감 추세는 하한 0.85로 제한", () => {
    const samples: DailyConsumption[] = Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(i + 1),
      amount: i < 7 ? 1 : 100,
    }));
    expect(computeTrendFactor(samples, today)).toBe(0.85);
  });
});

describe("forecastIngredient (합성)", () => {
  const baseSamples = (): DailyConsumption[] =>
    Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(i + 1),
      amount: 10,
    }));

  it("콜드스타트 → 예측 안 함, isColdStart=true", () => {
    const result = forecastIngredient({
      currentStock: 100,
      leadTimeDays: 1,
      safetyBufferDays: 1,
      consumptionSamples: baseSamples(),
      daysOff: [],
      signupDate: daysAgo(3),
      today,
    });
    expect(result.isColdStart).toBe(true);
    expect(result.expectedDepletionDate).toBeNull();
    expect(result.status).toBe("safe");
    expect(result.trend).toBe("normal");
  });

  it("정상 영업: 합성 출력 형식 검증", () => {
    const result = forecastIngredient({
      currentStock: 50,
      leadTimeDays: 1,
      safetyBufferDays: 1,
      consumptionSamples: baseSamples(),
      daysOff: [],
      signupDate: daysAgo(60),
      today,
    });
    expect(result.isColdStart).toBe(false);
    expect(result.expectedDepletionDate).toBeInstanceOf(Date);
    expect(["safe", "caution", "order_needed", "critical"]).toContain(result.status);
    expect(["normal", "rising", "falling"]).toContain(result.trend);
  });

  it("정기휴무 적용 — daysOff가 예측에 반영됨", () => {
    const noOffDay = forecastIngredient({
      currentStock: 100,
      leadTimeDays: 1,
      safetyBufferDays: 1,
      consumptionSamples: baseSamples(),
      daysOff: [],
      signupDate: daysAgo(60),
      today,
    });
    const oneOffDay = forecastIngredient({
      currentStock: 100,
      leadTimeDays: 1,
      safetyBufferDays: 1,
      consumptionSamples: baseSamples(),
      daysOff: ["SUN"],
      signupDate: daysAgo(60),
      today,
    });
    if (noOffDay.expectedDepletionDate && oneOffDay.expectedDepletionDate) {
      expect(oneOffDay.expectedDepletionDate.getTime()).toBeGreaterThanOrEqual(
        noOffDay.expectedDepletionDate.getTime(),
      );
    }
  });
});

describe("forecastMenuDemand", () => {
  it("콜드스타트면 horizon은 유지하되 예측 수량은 0", () => {
    const result = forecastMenuDemand({
      demandSamples: [{ date: daysAgo(1), quantity: 10 }],
      daysOff: [],
      signupDate: daysAgo(3),
      today,
      horizonDays: 3,
    });

    expect(result.isColdStart).toBe(true);
    expect(result.dailyPredictions).toHaveLength(3);
    expect(result.dailyPredictions.every((day) => day.predictedQuantity === 0)).toBe(true);
  });

  it("정기휴무일은 메뉴 수요 예측도 0으로 둔다", () => {
    const result = forecastMenuDemand({
      demandSamples: Array.from({ length: 30 }, (_, i) => ({
        date: daysAgo(i + 1),
        quantity: 10,
      })),
      daysOff: ["SUN"],
      signupDate: daysAgo(60),
      today,
      horizonDays: 3,
    });

    const sunday = result.dailyPredictions.find((day) => day.dayType === null);
    expect(sunday).toBeDefined();
    expect(sunday?.predictedQuantity).toBe(0);
  });

  it("영업일 타입별 판매 패턴을 메뉴 수요에 반영한다", () => {
    const samples: DailyMenuDemand[] = [
      { date: new Date("2026-04-24"), quantity: 60 },
      { date: new Date("2026-04-17"), quantity: 55 },
      { date: new Date("2026-04-10"), quantity: 50 },
      { date: new Date("2026-04-03"), quantity: 45 },
      { date: new Date("2026-04-27"), quantity: 8 },
      { date: new Date("2026-04-28"), quantity: 8 },
      { date: new Date("2026-04-29"), quantity: 8 },
      { date: new Date("2026-04-23"), quantity: 8 },
      { date: new Date("2026-04-22"), quantity: 8 },
      { date: new Date("2026-04-21"), quantity: 8 },
      { date: new Date("2026-04-20"), quantity: 8 },
      { date: new Date("2026-04-16"), quantity: 8 },
    ];

    const result = forecastMenuDemand({
      demandSamples: samples,
      daysOff: [],
      signupDate: daysAgo(60),
      today,
      horizonDays: 5,
    });

    const friday = result.dailyPredictions.find((day) => day.dayType === "friday");
    const weekday = result.dailyPredictions.find(
      (day) => day.dayType === "weekday" && day.date.toISOString().slice(0, 10) === "2026-05-04",
    );
    expect(friday?.predictedQuantity).toBeGreaterThan(weekday?.predictedQuantity ?? 0);
  });
});
