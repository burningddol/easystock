"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Field } from "@/components/ui/field";
import { useIngredients } from "@/features/purchase/hooks/useIngredients";
import { useApplyStockCount } from "../hooks/useApplyStockCount";
import { StockCountResultCard } from "./StockCountResultCard";
import type { ApplyStockCountResult } from "@/lib/supabase/rpc";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export function StockCountForm(): React.ReactElement {
  const router = useRouter();
  const { data: ingredients, isLoading } = useIngredients();
  const submit = useApplyStockCount();

  const [countedAt, setCountedAt] = useState(TODAY_ISO);
  const [actuals, setActuals] = useState<Map<string, number>>(new Map());
  const [result, setResult] = useState<ApplyStockCountResult | null>(null);

  // actuals Map identity가 매 입력마다 바뀌어 useMemo가 skip 못 함 → inline.
  const items = Array.from(actuals.entries())
    .filter(([, v]) => Number.isFinite(v))
    .map(([ingredientId, actualStock]) => ({ ingredientId, actualStock }));

  function handleSubmit(): void {
    if (items.length === 0) return;
    submit.mutate({ countedAt, items }, { onSuccess: setResult });
  }

  if (result) {
    return <StockCountResultCard result={result} onConfirm={() => router.push("/inventory")} />;
  }

  if (isLoading || !ingredients) {
    return <p className="text-body-regular text-ink-3">불러오는 중…</p>;
  }
  if (ingredients.length === 0) {
    return (
      <p className="text-body-regular text-ink-3">
        등록된 재료가 없어요. 먼저 매입 등록 또는 메뉴 템플릿 불러오기로 재료를 만들어주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-section pb-44">
      <Field label="실사 날짜">
        <input
          type="date"
          value={countedAt}
          onChange={(e) => setCountedAt(e.target.value)}
          max={TODAY_ISO}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
        />
      </Field>

      <ul className="flex flex-col gap-stack-tight">
        {ingredients.map((ing) => (
          <li
            key={ing.id}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card p-tile"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-body text-ink-1">{ing.name}</span>
              <span className="text-caption text-ink-3 tabular-nums">단위: {ing.unit}</span>
            </div>
            <input
              type="number"
              min={0}
              step="0.001"
              inputMode="decimal"
              placeholder="실재고 수량"
              value={actuals.get(ing.id) ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setActuals((prev) => {
                  const next = new Map(prev);
                  if (raw === "") {
                    next.delete(ing.id);
                  } else {
                    const n = Number(raw);
                    if (Number.isFinite(n) && n >= 0) next.set(ing.id, n);
                  }
                  return next;
                });
              }}
              className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
            />
          </li>
        ))}
      </ul>

      {submit.isError && (
        <p role="alert" className="text-caption text-red">
          {submit.error.message}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-bg px-screen py-stack">
        <div className="mx-auto flex max-w-screen-md items-center justify-end">
          <PrimaryButton
            type="button"
            onClick={handleSubmit}
            disabled={items.length === 0 || submit.isPending}
          >
            {submit.isPending ? "저장 중…" : `${items.length}개 항목 저장`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
