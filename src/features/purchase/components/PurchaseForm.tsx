"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { savePurchaseSchema, type SavePurchaseInput } from "../schemas";
import { useVendors, type VendorRow } from "../hooks/useVendors";
import { useIngredients, type IngredientRow } from "../hooks/useIngredients";
import { usePurchaseSubmit } from "../hooks/usePurchaseSubmit";
import { useIsFirstPurchase } from "../hooks/useIsFirstPurchase";
import { VendorQuickCreate } from "./VendorQuickCreate";
import { IngredientQuickCreate } from "./IngredientQuickCreate";
import { PriceChangeAlertList } from "./PriceChangeAlertList";
import type { PriceChangeAlert } from "@/lib/supabase/rpc";

const todayString = (): string => new Date().toISOString().slice(0, 10);

export function PurchaseForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledItems = getPrefilledPurchaseItems(searchParams);
  const prefilledVendorId = searchParams.get("vendorId") ?? "";
  const recommendationSnapshotId = searchParams.get("snapshotId");
  const { data: vendors } = useVendors();
  const { data: ingredients } = useIngredients();
  const { data: isFirstPurchase } = useIsFirstPurchase();
  const submit = usePurchaseSubmit();

  const [savedAlerts, setSavedAlerts] = useState<readonly PriceChangeAlert[] | null>(null);
  const [vendorPicker, setVendorPicker] = useState<"select" | "create">("select");
  const [ingredientPickerIdx, setIngredientPickerIdx] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SavePurchaseInput>({
    resolver: zodResolver(savePurchaseSchema),
    defaultValues: {
      vendorId: prefilledVendorId,
      purchasedAt: todayString(),
      items:
        prefilledItems.length > 0 ? prefilledItems : [{ ingredientId: "", quantity: 0, amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: SavePurchaseInput): void {
    setSavedAlerts(null);
    submit.mutate(
      { ...values, isFirstPurchase: isFirstPurchase ?? false, recommendationSnapshotId },
      {
        onSuccess: (result) => {
          setSavedAlerts(result.priceChangeAlerts);
          if (result.priceChangeAlerts.length === 0) {
            // 알림 없으면 즉시 inventory로 복귀
            router.push("/inventory");
          }
        },
      },
    );
  }

  if (savedAlerts && savedAlerts.length > 0) {
    return (
      <div className="flex flex-col gap-section">
        <PriceChangeAlertList alerts={savedAlerts} />
        <PrimaryButton type="button" onClick={() => router.push("/inventory")} className="halo-cta">
          확인했어요
        </PrimaryButton>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="flex flex-col gap-section"
      noValidate
    >
      <Field label="거래처" error={errors.vendorId?.message}>
        <Controller
          control={control}
          name="vendorId"
          render={({ field }) => (
            <VendorPicker
              vendors={vendors ?? []}
              value={field.value}
              onChange={field.onChange}
              mode={vendorPicker}
              setMode={setVendorPicker}
              onCreated={(v) => {
                field.onChange(v.id);
                setVendorPicker("select");
              }}
            />
          )}
        />
      </Field>

      <Field label="매입일" error={errors.purchasedAt?.message}>
        <input
          {...register("purchasedAt")}
          type="date"
          max={todayString()}
          className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 tabular-nums shadow-soft"
        />
      </Field>

      <section className="glow-panel flex flex-col gap-stack-tight rounded-[28px] border border-border bg-card p-5 shadow-card">
        <header className="flex items-center justify-between">
          <span className="text-label text-ink-2">매입 항목</span>
          <button
            type="button"
            onClick={() => append({ ingredientId: "", quantity: 0, amount: 0 })}
            className="rounded-xl border border-border bg-card px-stack py-2 text-label text-ink-2 shadow-soft hover:bg-card-hover"
          >
            + 항목 추가
          </button>
        </header>

        {prefilledItems.length > 0 && (
          <p className="rounded-2xl bg-blue-soft px-3 py-2 text-caption text-blue-deep">
            재고 예측의 권장 발주 항목 {prefilledItems.length}개를 채웠어요. 실제 거래 금액만
            입력하면 됩니다.
          </p>
        )}

        {fields.map((field, idx) => (
          <ItemRow
            key={field.id}
            idx={idx}
            register={register}
            control={control}
            ingredients={ingredients ?? []}
            onRemove={() => remove(idx)}
            errorMessage={
              errors.items?.[idx]?.quantity?.message ??
              errors.items?.[idx]?.amount?.message ??
              errors.items?.[idx]?.ingredientId?.message
            }
            quickCreateOpen={ingredientPickerIdx === idx}
            onOpenQuickCreate={() => setIngredientPickerIdx(idx)}
            onCloseQuickCreate={() => setIngredientPickerIdx(null)}
            onIngredientCreated={(i) => {
              setValue(`items.${idx}.ingredientId`, i.id);
              setIngredientPickerIdx(null);
            }}
          />
        ))}
      </section>

      {submit.isError && (
        <p role="alert" className="text-body-regular text-red">
          {submit.error.message}
        </p>
      )}

      <PrimaryButton type="submit" disabled={isSubmitting || submit.isPending} className="halo-cta">
        {submit.isPending ? "저장 중…" : "매입 저장"}
      </PrimaryButton>
    </form>
  );
}

function getPrefilledPurchaseItems(
  searchParams: ReturnType<typeof useSearchParams>,
): SavePurchaseInput["items"] {
  const items = searchParams.getAll("item").flatMap(parsePrefilledItem);
  if (items.length > 0) return items;

  const ingredientId = searchParams.get("ingredientId");
  const quantity = Number(searchParams.get("quantity"));
  if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0) return [];

  return [
    {
      ingredientId,
      quantity,
      amount: 0,
    },
  ];
}

function parsePrefilledItem(raw: string): SavePurchaseInput["items"] {
  const [ingredientId, quantityRaw] = raw.split(":");
  const quantity = Number(quantityRaw);
  if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0) return [];
  return [{ ingredientId, quantity, amount: 0 }];
}

interface VendorPickerProps {
  vendors: readonly VendorRow[];
  value: string;
  onChange: (id: string) => void;
  mode: "select" | "create";
  setMode: (m: "select" | "create") => void;
  onCreated: (v: VendorRow) => void;
}

function VendorPicker({
  vendors,
  value,
  onChange,
  mode,
  setMode,
  onCreated,
}: VendorPickerProps): React.ReactElement {
  if (mode === "create") {
    return <VendorQuickCreate onCreated={onCreated} onCancel={() => setMode("select")} />;
  }
  return (
    <div className="flex gap-stack-tight">
      <select
        name="vendorId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 shadow-soft"
      >
        <option value="">거래처 선택</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setMode("create")}
        className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-2 shadow-soft hover:bg-card-hover"
      >
        + 신규
      </button>
    </div>
  );
}

interface ItemRowProps {
  idx: number;
  register: ReturnType<typeof useForm<SavePurchaseInput>>["register"];
  control: ReturnType<typeof useForm<SavePurchaseInput>>["control"];
  ingredients: readonly IngredientRow[];
  onRemove: () => void;
  errorMessage?: string;
  quickCreateOpen: boolean;
  onOpenQuickCreate: () => void;
  onCloseQuickCreate: () => void;
  onIngredientCreated: (i: IngredientRow) => void;
}

function ItemRow({
  idx,
  register,
  control,
  ingredients,
  onRemove,
  errorMessage,
  quickCreateOpen,
  onOpenQuickCreate,
  onCloseQuickCreate,
  onIngredientCreated,
}: ItemRowProps): React.ReactElement {
  if (quickCreateOpen) {
    return <IngredientQuickCreate onCreated={onIngredientCreated} onCancel={onCloseQuickCreate} />;
  }
  return (
    <div className="glow-panel flex flex-col gap-1 rounded-[24px] border border-border bg-card p-tile shadow-card">
      <Controller
        control={control}
        name={`items.${idx}.ingredientId`}
        render={({ field }) => (
          <div className="flex gap-stack-tight">
            <select
              name={field.name}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="flex-1 rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 shadow-soft"
            >
              <option value="">재료 선택</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenQuickCreate}
              className="rounded-2xl border border-border bg-card px-stack py-stack text-label text-ink-2 shadow-soft hover:bg-card-hover"
            >
              + 신규
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-stack-tight">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-3">수량</span>
          <input
            {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="0.001"
            className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 tabular-nums shadow-soft"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-3">금액 (원)</span>
          <input
            {...register(`items.${idx}.amount`, { valueAsNumber: true })}
            type="number"
            min={0}
            className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 tabular-nums shadow-soft"
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        {errorMessage && <span className="text-caption text-red">{errorMessage}</span>}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-caption text-ink-3 hover:text-red"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
