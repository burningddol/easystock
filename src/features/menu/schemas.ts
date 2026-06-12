import { z } from "zod";
import { STORE_TYPES } from "@/features/auth/schemas";

/**
 * 메뉴 도메인 입력 스키마. RPC / API route 경계에서 검증.
 * data-model §6, contracts/domain-rpc.md `clone_menu_template`.
 */

export const recipeItemSchema = z.object({
  ingredientId: z.string().uuid(),
  quantityPerServing: z.number().positive(),
});

export type RecipeItemInput = z.infer<typeof recipeItemSchema>;

export const optionRecipeItemSchema = z.object({
  ingredientId: z.string().uuid(),
  quantityPerSelection: z.number().positive(),
});

export const optionValueSchema = z.object({
  name: z.string().min(1, "옵션명을 입력해주세요").max(50, "50자 이내로 입력해주세요"),
  priceDelta: z.number().nonnegative("추가금은 0원 이상이어야 합니다"),
  isDefault: z.boolean().default(false),
  recipe: z.array(optionRecipeItemSchema).default([]),
});

export const optionGroupSchema = z.object({
  name: z.string().min(1, "옵션 그룹명을 입력해주세요").max(50, "50자 이내로 입력해주세요"),
  selectionType: z.enum(["single", "add_on"]).default("add_on"),
  isRequired: z.boolean().default(false),
  minSelect: z.number().int().nonnegative().default(0),
  maxSelect: z.number().int().positive().nullable().optional(),
  values: z.array(optionValueSchema).default([]),
});

export const menuSchema = z.object({
  name: z.string().min(1, "메뉴 이름을 입력해주세요").max(50, "50자 이내로 입력해주세요"),
  price: z.number().nonnegative("가격은 0원 이상이어야 합니다"),
  recipe: z.array(recipeItemSchema).default([]),
  optionGroups: z.array(optionGroupSchema).default([]),
});

export type MenuInput = z.infer<typeof menuSchema>;

export const cloneTemplateSchema = z.object({
  storeType: z.enum(STORE_TYPES),
});

export type CloneTemplateInput = z.infer<typeof cloneTemplateSchema>;
