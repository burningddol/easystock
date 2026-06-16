import { describe, expect, it, vi } from "vitest";
import { saveMenuOptions } from "@/lib/supabase/rpc";

describe("menu option RPC payload", () => {
  it("saveMenuOptions maps nested option groups to snake_case payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await saveMenuOptions(
      { rpc },
      {
        menuId: "menu-1",
        optionGroups: [
          {
            name: "토핑 추가",
            selectionType: "add_on",
            isRequired: false,
            minSelect: 0,
            maxSelect: 2,
            values: [
              {
                name: "연유 추가",
                priceDelta: 500,
                isDefault: false,
                recipe: [{ ingredientId: "ing-1", quantityPerSelection: 10 }],
              },
            ],
          },
        ],
      },
    );

    expect(rpc).toHaveBeenCalledWith("save_menu_options", {
      p_menu_id: "menu-1",
      p_option_groups: [
        {
          name: "토핑 추가",
          selection_type: "add_on",
          is_required: false,
          min_select: 0,
          max_select: 2,
          sort_order: 0,
          values: [
            {
              name: "연유 추가",
              price_delta: 500,
              is_default: false,
              sort_order: 0,
              recipe: [{ ingredient_id: "ing-1", quantity_per_selection: 10 }],
            },
          ],
        },
      ],
    });
  });
});
