"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trackEvent } from "@/lib/analytics/ga4";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { menuSchema, type MenuInput } from "../schemas";
import { useCreateMenu, useEditMenu } from "../hooks/useMenuMutations";

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

type MenuFormMode =
  | { kind: "create"; isFirstMenu: boolean }
  | { kind: "edit"; menuId: string; initialValues: MenuInput };

interface MenuFormProps {
  ingredients: readonly IngredientOption[];
  mode: MenuFormMode;
}

export function MenuForm({ ingredients, mode }: MenuFormProps): React.ReactElement {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateMenu();
  const editMutation = useEditMenu();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MenuInput>({
    resolver: zodResolver(menuSchema),
    defaultValues:
      mode.kind === "edit"
        ? mode.initialValues
        : { name: "", price: 0, recipe: [], optionGroups: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "recipe" });
  const {
    fields: optionGroupFields,
    append: appendOptionGroup,
    remove: removeOptionGroup,
  } = useFieldArray({ control, name: "optionGroups" });

  async function onSubmit(values: MenuInput): Promise<void> {
    setSubmitError(null);

    if (mode.kind === "edit") {
      try {
        await editMutation.mutateAsync({ menuId: mode.menuId, values });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "수정 실패");
        return;
      }
      router.push(`/menu/${mode.menuId}`);
      return;
    }

    try {
      await createMutation.mutateAsync(values);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "저장 실패");
      return;
    }
    if (mode.isFirstMenu) trackEvent("first_menu_registered", {});
    router.push("/menu");
  }

  const submitting = isSubmitting || editMutation.isPending || createMutation.isPending;
  const submitLabel = mode.kind === "edit" ? "수정 저장" : "저장";

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
              append({ ingredientId: ingredients[0]?.id ?? "", quantityPerServing: 1 })
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

      <section className="flex flex-col gap-stack-tight">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-label text-ink-2">옵션 / 커스터마이징</span>
            <span className="text-caption text-ink-3">
              예: 빵 선택, 연유 추가, 샷 추가처럼 추가금과 추가 재료를 관리합니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              appendOptionGroup({
                name: "",
                selectionType: "add_on",
                isRequired: false,
                minSelect: 0,
                maxSelect: null,
                values: [],
              })
            }
            className="rounded-md border border-border px-stack py-1 text-label text-ink-2 hover:bg-card-hover"
          >
            + 옵션 그룹
          </button>
        </header>

        {optionGroupFields.length === 0 && (
          <p className="rounded-3xl bg-slate-50 px-4 py-3 text-caption text-ink-3">
            옵션이 없는 메뉴면 비워두면 됩니다.
          </p>
        )}

        {optionGroupFields.map((field, idx) => (
          <OptionGroupEditor
            key={field.id}
            groupIdx={idx}
            control={control}
            register={register}
            ingredients={ingredients}
            onRemove={() => removeOptionGroup(idx)}
          />
        ))}
      </section>

      {submitError && (
        <p role="alert" className="text-body-regular text-red">
          {submitError}
        </p>
      )}

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "저장 중…" : submitLabel}
      </PrimaryButton>
    </form>
  );
}

interface RecipeRowProps {
  idx: number;
  register: UseFormRegister<MenuInput>;
  ingredients: readonly IngredientOption[];
  onRemove: () => void;
  error?: string;
}

interface OptionGroupEditorProps {
  groupIdx: number;
  control: Control<MenuInput>;
  register: UseFormRegister<MenuInput>;
  ingredients: readonly IngredientOption[];
  onRemove: () => void;
}

function OptionGroupEditor({
  groupIdx,
  control,
  register,
  ingredients,
  onRemove,
}: OptionGroupEditorProps): React.ReactElement {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `optionGroups.${groupIdx}.values` as const,
  });

  return (
    <article className="flex flex-col gap-stack rounded-[28px] border border-border bg-card p-stack shadow-soft">
      <div className="grid gap-stack-tight md:grid-cols-[1fr_150px_auto_auto] md:items-end">
        <Field label="그룹명">
          <input
            {...register(`optionGroups.${groupIdx}.name`)}
            placeholder="예: 토핑 추가"
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
          />
        </Field>
        <Field label="방식">
          <select
            {...register(`optionGroups.${groupIdx}.selectionType`)}
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
          >
            <option value="add_on">추가형</option>
            <option value="single">택1형</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 rounded-md border border-border px-stack py-stack-tight text-caption text-ink-2">
          <input type="checkbox" {...register(`optionGroups.${groupIdx}.isRequired`)} />
          필수
        </label>
        <button type="button" onClick={onRemove} className="text-caption text-ink-3 hover:text-red">
          그룹 삭제
        </button>
      </div>

      <div className="grid grid-cols-2 gap-stack-tight">
        <Field label="최소 선택">
          <input
            {...register(`optionGroups.${groupIdx}.minSelect`, { valueAsNumber: true })}
            type="number"
            min={0}
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
          />
        </Field>
        <Field label="최대 선택 (비우면 제한 없음)">
          <input
            {...register(`optionGroups.${groupIdx}.maxSelect`, {
              setValueAs: (value) => (value === "" ? null : Number(value)),
            })}
            type="number"
            min={1}
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-stack-tight">
        <header className="flex items-center justify-between">
          <span className="text-caption font-semibold text-ink-2">선택지</span>
          <button
            type="button"
            onClick={() => append({ name: "", priceDelta: 0, isDefault: false, recipe: [] })}
            className="rounded-md border border-border px-stack py-1 text-caption text-ink-2 hover:bg-card-hover"
          >
            + 선택지
          </button>
        </header>
        {fields.map((field, valueIdx) => (
          <OptionValueEditor
            key={field.id}
            groupIdx={groupIdx}
            valueIdx={valueIdx}
            control={control}
            register={register}
            ingredients={ingredients}
            onRemove={() => remove(valueIdx)}
          />
        ))}
      </div>
    </article>
  );
}

interface OptionValueEditorProps extends Omit<OptionGroupEditorProps, "groupIdx" | "onRemove"> {
  groupIdx: number;
  valueIdx: number;
  onRemove: () => void;
}

function OptionValueEditor({
  groupIdx,
  valueIdx,
  control,
  register,
  ingredients,
  onRemove,
}: OptionValueEditorProps): React.ReactElement {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `optionGroups.${groupIdx}.values.${valueIdx}.recipe` as const,
  });

  return (
    <div className="flex flex-col gap-stack-tight rounded-3xl bg-slate-50/90 p-stack-tight">
      <div className="grid gap-stack-tight md:grid-cols-[1fr_120px_auto_auto] md:items-end">
        <Field label="옵션명">
          <input
            {...register(`optionGroups.${groupIdx}.values.${valueIdx}.name`)}
            placeholder="예: 연유 추가"
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
          />
        </Field>
        <Field label="추가금">
          <input
            {...register(`optionGroups.${groupIdx}.values.${valueIdx}.priceDelta`, {
              valueAsNumber: true,
            })}
            type="number"
            min={0}
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
          />
        </Field>
        <label className="flex items-center gap-2 rounded-md border border-border bg-white px-stack py-stack-tight text-caption text-ink-2">
          <input
            type="checkbox"
            {...register(`optionGroups.${groupIdx}.values.${valueIdx}.isDefault`)}
          />
          기본
        </label>
        <button type="button" onClick={onRemove} className="text-caption text-ink-3 hover:text-red">
          삭제
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() =>
            append({ ingredientId: ingredients[0]?.id ?? "", quantityPerSelection: 1 })
          }
          disabled={ingredients.length === 0}
          className="self-start rounded-md border border-border px-stack py-1 text-caption text-ink-2 hover:bg-card-hover disabled:opacity-50"
        >
          + 옵션 재료
        </button>
        {fields.map((field, recipeIdx) => (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_100px_auto] items-center gap-stack-tight"
          >
            <select
              {...register(
                `optionGroups.${groupIdx}.values.${valueIdx}.recipe.${recipeIdx}.ingredientId`,
              )}
              className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit})
                </option>
              ))}
            </select>
            <input
              {...register(
                `optionGroups.${groupIdx}.values.${valueIdx}.recipe.${recipeIdx}.quantityPerSelection`,
                { valueAsNumber: true },
              )}
              type="number"
              min={0}
              step="0.001"
              className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
            />
            <button
              type="button"
              onClick={() => remove(recipeIdx)}
              className="text-caption text-ink-3 hover:text-red"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
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
