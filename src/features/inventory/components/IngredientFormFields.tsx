"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { INGREDIENT_UNIT_LABELS, type IngredientInput } from "@/features/purchase/schemas";

interface IngredientFormFieldsProps {
  register: UseFormRegister<IngredientInput>;
  errors: FieldErrors<IngredientInput>;
  unitLabel?: string;
  namePlaceholder?: string;
  autoFocusName?: boolean;
  errorMessage?: string;
}

/**
 * 재료 등록 폼의 본문 필드 — AddIngredientForm(<form>)과
 * IngredientQuickCreate(<div>, 중첩 form 회피) 두 컨테이너에서 공유.
 */
export function IngredientFormFields({
  register,
  errors,
  unitLabel = "단위",
  namePlaceholder,
  autoFocusName = false,
  errorMessage,
}: IngredientFormFieldsProps): React.ReactElement {
  return (
    <>
      <Field label="재료 이름" error={errors.name?.message}>
        <input
          {...register("name")}
          type="text"
          placeholder={namePlaceholder}
          autoFocus={autoFocusName}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label={unitLabel} error={errors.unit?.message}>
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

      {errorMessage && (
        <p role="alert" className="text-body-regular text-red">
          {errorMessage}
        </p>
      )}
    </>
  );
}
