"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ingredientInputSchema, type IngredientInput } from "@/features/purchase/schemas";
import { useCreateIngredient } from "@/features/purchase/hooks/useIngredients";
import { IngredientFormFields } from "./IngredientFormFields";

interface AddIngredientFormProps {
  onClose: () => void;
}

/**
 * 재료 등록 폼. 토글은 부모(InventoryPage)가 관리 — 헤더 버튼으로 열고 onClose로 닫음.
 * unit은 등록 후 변경 불가 (data-model.md §2 reject_unit_change 트리거) — 라벨에 명시.
 */
export function AddIngredientForm({ onClose }: AddIngredientFormProps): React.ReactElement {
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
    await createMutation.mutateAsync(values);
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
            onClose();
          }}
          className="text-caption text-ink-3 hover:text-ink-2"
        >
          취소
        </button>
      </header>

      <IngredientFormFields
        register={register}
        errors={errors}
        unitLabel="단위 (등록 후 변경 불가)"
        namePlaceholder="예: 우유, 시럽, 컵"
        errorMessage={createMutation.error?.message}
      />

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "등록 중…" : "등록"}
      </PrimaryButton>
    </form>
  );
}
