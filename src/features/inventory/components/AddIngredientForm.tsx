"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ingredientInputSchema, type IngredientInput } from "@/features/purchase/schemas";
import { useCreateIngredient } from "@/features/purchase/hooks/useIngredients";

interface AddIngredientFormProps {
  onClose: () => void;
}

const UNIT_LABELS: Record<IngredientInput["unit"], string> = {
  g: "g (그램)",
  ml: "ml (밀리리터)",
  piece: "개",
};

/**
 * 재료 등록 폼. 토글은 부모(InventoryPage)가 관리 — 헤더 버튼으로 열고 onClose로 닫음.
 * unit은 등록 후 변경 불가 (data-model.md §2 reject_unit_change 트리거) — 라벨에 명시.
 */
export function AddIngredientForm({ onClose }: AddIngredientFormProps): React.ReactElement {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateIngredient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IngredientInput>({
    resolver: zodResolver(ingredientInputSchema),
    defaultValues: { name: "", unit: "g" },
  });

  async function onSubmit(values: IngredientInput): Promise<void> {
    setSubmitError(null);
    try {
      await createMutation.mutateAsync(values);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "등록 실패");
      return;
    }
    reset();
    onClose();
  }

  const submitting = isSubmitting || createMutation.isPending;

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile"
      noValidate
    >
      <header className="flex items-center justify-between">
        <h2 className="text-label text-ink-2">재료 등록</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setSubmitError(null);
            onClose();
          }}
          className="text-caption text-ink-3 hover:text-ink-2"
        >
          취소
        </button>
      </header>

      <Field label="재료 이름" error={errors.name?.message}>
        <input
          {...register("name")}
          type="text"
          placeholder="예: 우유, 시럽, 컵"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="단위 (등록 후 변경 불가)" error={errors.unit?.message}>
        <select
          {...register("unit")}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        >
          {(Object.keys(UNIT_LABELS) as Array<IngredientInput["unit"]>).map((unit) => (
            <option key={unit} value={unit}>
              {UNIT_LABELS[unit]}
            </option>
          ))}
        </select>
      </Field>

      {submitError && (
        <p role="alert" className="text-body-regular text-red">
          {submitError}
        </p>
      )}

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "등록 중…" : "등록"}
      </PrimaryButton>
    </form>
  );
}
