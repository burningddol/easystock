import { describe, expect, it, vi } from "vitest";
import { editSale, saveSale } from "@/lib/supabase/rpc";

describe("sale RPC option payload", () => {
  it("saveSale maps selected options to snake_case RPC payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await saveSale(
      { rpc },
      {
        soldAt: "2026-06-12",
        items: [
          {
            menuId: "menu-1",
            quantity: 3,
            options: [{ optionValueId: "option-1", quantity: 2 }],
          },
        ],
      },
    );

    expect(rpc).toHaveBeenCalledWith("save_sale", {
      p_sold_at: "2026-06-12",
      p_items: [
        {
          menu_id: "menu-1",
          quantity: 3,
          options: [{ option_value_id: "option-1", quantity: 2 }],
        },
      ],
    });
  });

  it("editSale maps selected options to snake_case RPC payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await editSale(
      { rpc },
      {
        saleId: "sale-1",
        newItems: [
          {
            menuId: "menu-1",
            quantity: 1,
            options: [{ optionValueId: "option-1", quantity: 1 }],
          },
        ],
        reason: "옵션 정정",
      },
    );

    expect(rpc).toHaveBeenCalledWith("edit_sale", {
      p_sale_id: "sale-1",
      p_new_items: [
        {
          menu_id: "menu-1",
          quantity: 1,
          options: [{ option_value_id: "option-1", quantity: 1 }],
        },
      ],
      p_reason: "옵션 정정",
    });
  });
});
