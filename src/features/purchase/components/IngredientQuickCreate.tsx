"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { INGREDIENT_UNIT_LABELS, ingredientInputSchema, type IngredientInput } from "../schemas";
import { useCreateIngredient, type IngredientRow } from "../hooks/useIngredients";

interface IngredientQuickCreateProps {
  onCreated: (ingredient: IngredientRow) => void;
  onCancel: () => void;
}

export function IngredientQuickCreate({
  onCreated,
  onCancel,
}: IngredientQuickCreateProps): React.ReactElement {
  const mutation = useCreateIngredient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IngredientInput>({
    resolver: zodResolver(ingredientInputSchema),
    defaultValues: { name: "", unit: "g" },
  });

  async function onSubmit(values: IngredientInput): Promise<void> {
    const created = await mutation.mutateAsync(values);
    onCreated(created);
  }

  // 부모 PurchaseForm이 이미 <form>이라 중첩 <form> 회피 — <div>로 렌더하고 추가 버튼은
  // type="button" + handleSubmit() 직접 호출.
  return (
    <div className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
      <h3 className="text-title-md text-ink-1">새 재료 추가</h3>

      <Field label="재료 이름" error={errors.name?.message}>
        <input
          {...register("name")}
          type="text"
          autoFocus
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="단위" error={errors.unit?.message}>
        <select
          {...register("unit")}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        >
          {Object.entries(INGREDIENT_UNIT_LABELS).map(([unit, label]) => (
            <option key={unit} value={unit}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      {mutation.error && (
        <p role="alert" className="text-caption text-red">
          {mutation.error.message}
        </p>
      )}

      <div className="flex gap-stack">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-stack py-stack text-body-regular text-ink-2 hover:bg-card-hover"
        >
          취소
        </button>
        <PrimaryButton
          type="button"
          onClick={() => void handleSubmit(onSubmit)()}
          disabled={isSubmitting}
          className="ml-auto"
        >
          {isSubmitting ? "추가 중…" : "추가"}
        </PrimaryButton>
      </div>
    </div>
  );
}
