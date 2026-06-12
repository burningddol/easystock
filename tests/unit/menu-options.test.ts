import { describe, expect, it } from "vitest";
import {
  computeOptionIngredientRequirements,
  validateMenuOptionSelections,
  type MenuOptionGroupPolicy,
} from "@/lib/domain/menu-options";

describe("menu option domain", () => {
  const breadGroup: MenuOptionGroupPolicy = {
    groupId: "bread",
    selectionType: "single",
    isRequired: true,
    minSelect: 0,
    maxSelect: 1,
  };

  const toppingGroup: MenuOptionGroupPolicy = {
    groupId: "topping",
    selectionType: "add_on",
    isRequired: false,
    minSelect: 0,
    maxSelect: 2,
  };

  it("single 옵션은 메뉴 수량과 선택 합계가 같아야 한다", () => {
    expect(
      validateMenuOptionSelections({
        menuQuantity: 10,
        groups: [breadGroup],
        selections: [
          { groupId: "bread", optionValueId: "milk-bread", quantity: 7 },
          { groupId: "bread", optionValueId: "wheat-bread", quantity: 3 },
        ],
      }),
    ).toEqual([]);

    expect(
      validateMenuOptionSelections({
        menuQuantity: 10,
        groups: [breadGroup],
        selections: [{ groupId: "bread", optionValueId: "milk-bread", quantity: 8 }],
      }),
    ).toContain("required_option_missing:bread");
  });

  it("add_on 옵션은 메뉴 수량 대비 maxSelect 배수까지 허용한다", () => {
    expect(
      validateMenuOptionSelections({
        menuQuantity: 5,
        groups: [toppingGroup],
        selections: [{ groupId: "topping", optionValueId: "condensed-milk", quantity: 10 }],
      }),
    ).toEqual([]);

    expect(
      validateMenuOptionSelections({
        menuQuantity: 5,
        groups: [toppingGroup],
        selections: [{ groupId: "topping", optionValueId: "condensed-milk", quantity: 11 }],
      }),
    ).toContain("option_max_exceeded:topping");
  });

  it("옵션 선택량과 옵션 레시피로 재료 소요량을 합산한다", () => {
    expect(
      computeOptionIngredientRequirements({
        selections: [
          { groupId: "bread", optionValueId: "wheat-bread", quantity: 6 },
          { groupId: "topping", optionValueId: "condensed-milk", quantity: 4 },
        ],
        recipeItems: [
          { optionValueId: "wheat-bread", ingredientId: "whole-wheat", quantityPerSelection: 2 },
          { optionValueId: "condensed-milk", ingredientId: "milk", quantityPerSelection: 30 },
        ],
      }),
    ).toEqual([
      { ingredientId: "milk", quantity: 120 },
      { ingredientId: "whole-wheat", quantity: 12 },
    ]);
  });
});
