"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { saveMenu } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { menuSchema, type MenuInput } from "../schemas";
import { menuListQueryKey } from "../hooks/useMenus";

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

interface MenuFormProps {
  ingredients: readonly IngredientOption[];
  isFirstMenu: boolean;
}

export function MenuForm({ ingredients, isFirstMenu }: MenuFormProps): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MenuInput>({
    resolver: zodResolver(menuSchema),
    defaultValues: { name: "", price: 0, recipe: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "recipe" });

  async function onSubmit(values: MenuInput): Promise<void> {
    setSubmitError(null);

    const supabase = createClient();
    const { error } = await saveMenu(supabase, {
      name: values.name,
      price: values.price,
      recipe: values.recipe,
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    if (isFirstMenu) {
      trackEvent("first_menu_registered", {});
    }

    void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
    router.push("/menu");
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-stack"
      noValidate
    >
      <Field label="메뉴 이름" error={errors.name?.message}>
        <input
          {...register("name")}
          type="text"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="판매가 (원)" error={errors.price?.message}>
        <input
          {...register("price", { valueAsNumber: true })}
          type="number"
          min={0}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
        />
      </Field>

      <section className="flex flex-col gap-stack-tight">
        <header className="flex items-center justify-between">
          <span className="text-label text-ink-2">레시피 (1회 제공량)</span>
          <button
            type="button"
            onClick={() =>
              append({ ingredientId: ingredients[0]?.id ?? "", quantityPerServing: 0 })
            }
            className="rounded-md border border-border px-stack py-1 text-label text-ink-2 hover:bg-card-hover"
            disabled={ingredients.length === 0}
          >
            + 재료 추가
          </button>
        </header>

        {ingredients.length === 0 && (
          <p className="text-caption text-ink-3">
            재료를 먼저 등록해주세요. (템플릿 불러오면 재료/메뉴가 함께 만들어집니다.)
          </p>
        )}

        {fields.map((field, idx) => (
          <RecipeRow
            key={field.id}
            idx={idx}
            register={register}
            ingredients={ingredients}
            onRemove={() => remove(idx)}
            error={errors.recipe?.[idx]?.quantityPerServing?.message}
          />
        ))}
      </section>

      {submitError && (
        <p role="alert" className="text-body-regular text-red">
          {submitError}
        </p>
      )}

      <PrimaryButton type="submit" disabled={isSubmitting}>
        {isSubmitting ? "저장 중…" : "저장"}
      </PrimaryButton>
    </form>
  );
}

interface RecipeRowProps {
  idx: number;
  register: ReturnType<typeof useForm<MenuInput>>["register"];
  ingredients: readonly IngredientOption[];
  onRemove: () => void;
  error?: string;
}

function RecipeRow({
  idx,
  register,
  ingredients,
  onRemove,
  error,
}: RecipeRowProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[1fr_100px_auto] items-center gap-stack-tight">
        <select
          {...register(`recipe.${idx}.ingredientId`)}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        >
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name} ({ing.unit})
            </option>
          ))}
        </select>
        <input
          {...register(`recipe.${idx}.quantityPerServing`, { valueAsNumber: true })}
          type="number"
          min={0}
          step="0.001"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
        />
        <button type="button" onClick={onRemove} className="text-caption text-ink-3 hover:text-red">
          삭제
        </button>
      </div>
      {error && <span className="text-caption text-red">{error}</span>}
    </div>
  );
}
