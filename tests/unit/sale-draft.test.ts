import { describe, expect, it } from "vitest";
import {
  clearSaleDraftDate,
  replaceSaleDraftDateItems,
  sanitizeSaleDraftItems,
  upsertSaleDraftItems,
  type SaleDraftsByDate,
} from "@/stores/sale-draft";

describe("sale draft helpers", () => {
  it("날짜별로 드래프트를 분리해서 저장한다", () => {
    const first = upsertSaleDraftItems({}, "2026-06-01", "menu-a", 2);
    const second = upsertSaleDraftItems(first, "2026-06-02", "menu-b", 3);

    expect(second).toEqual({
      "2026-06-01": [{ menuId: "menu-a", quantity: 2 }],
      "2026-06-02": [{ menuId: "menu-b", quantity: 3 }],
    });
  });

  it("지정한 날짜의 드래프트만 지운다", () => {
    const drafts: SaleDraftsByDate = {
      "2026-06-01": [{ menuId: "menu-a", quantity: 2 }],
      "2026-06-02": [{ menuId: "menu-b", quantity: 3 }],
    };

    expect(clearSaleDraftDate(drafts, "2026-06-01")).toEqual({
      "2026-06-02": [{ menuId: "menu-b", quantity: 3 }],
    });
  });

  it("현재 메뉴에 없는 항목은 제거한다", () => {
    const filtered = sanitizeSaleDraftItems(
      [
        { menuId: "menu-a", quantity: 2 },
        { menuId: "menu-x", quantity: 1 },
      ],
      new Set(["menu-a", "menu-b"]),
    );

    expect(filtered).toEqual([{ menuId: "menu-a", quantity: 2 }]);
  });

  it("드래프트 항목을 날짜 단위로 통째로 교체한다", () => {
    const drafts: SaleDraftsByDate = {
      "2026-06-01": [{ menuId: "menu-a", quantity: 2 }],
    };

    expect(
      replaceSaleDraftDateItems(drafts, "2026-06-01", [{ menuId: "menu-b", quantity: 4 }]),
    ).toEqual({
      "2026-06-01": [{ menuId: "menu-b", quantity: 4 }],
    });
  });
});
