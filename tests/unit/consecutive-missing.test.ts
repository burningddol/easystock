import { describe, it, expect } from "vitest";
import { withConsecutiveMissingDays } from "@/features/calendar/lib/consecutive-missing";
import type { CalendarCell } from "@/lib/supabase/rpc";

const baseCell = (overrides: Partial<CalendarCell>): CalendarCell => ({
  date: overrides.date ?? "2026-04-01",
  isFuture: false,
  isBeforeSignup: false,
  isRegularDayOff: false,
  hasSale: false,
  hasPurchase: false,
  isMissing: false,
  revenue: null,
  netProfit: null,
  ...overrides,
});

describe("withConsecutiveMissingDays", () => {
  it("연속 누락일에 1, 2, 3 누적", () => {
    const cells: CalendarCell[] = [
      baseCell({ date: "2026-04-01", hasSale: true }),
      baseCell({ date: "2026-04-02", isMissing: true }),
      baseCell({ date: "2026-04-03", isMissing: true }),
      baseCell({ date: "2026-04-04", isMissing: true }),
      baseCell({ date: "2026-04-05", hasSale: true }),
    ];
    const result = withConsecutiveMissingDays(cells);
    expect(result.map((c) => c.consecutiveMissingDays)).toEqual([0, 1, 2, 3, 0]);
  });

  it("정기휴무·미래·가입전 셀이 끼면 런이 끊긴다 (isMissing=false 기준)", () => {
    const cells: CalendarCell[] = [
      baseCell({ date: "2026-04-01", isMissing: true }),
      baseCell({ date: "2026-04-02", isRegularDayOff: true }),
      baseCell({ date: "2026-04-03", isMissing: true }),
      baseCell({ date: "2026-04-04", isFuture: true }),
      baseCell({ date: "2026-04-05", isMissing: true }),
      baseCell({ date: "2026-04-06", isBeforeSignup: true }),
      baseCell({ date: "2026-04-07", isMissing: true }),
    ];
    const result = withConsecutiveMissingDays(cells);
    expect(result.map((c) => c.consecutiveMissingDays)).toEqual([1, 0, 1, 0, 1, 0, 1]);
  });

  it("빈 배열 통과", () => {
    expect(withConsecutiveMissingDays([])).toEqual([]);
  });
});
