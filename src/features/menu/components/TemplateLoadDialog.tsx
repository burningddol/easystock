"use client";

import { useState } from "react";
import { STORE_TYPES, STORE_TYPE_LABELS } from "@/features/auth/schemas";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useCloneTemplate } from "../hooks/useCloneTemplate";
import { cn } from "@/lib/utils";

type StoreType = (typeof STORE_TYPES)[number];

// dessert_cafe는 아직 템플릿이 없음 — Partial로 두어 dead `count: 0` 항목을 두지 않음.
// 호출 측은 lookup undefined를 "템플릿 없음"으로 해석.
const TEMPLATE_PREVIEWS: Partial<Record<StoreType, { count: number; samples: string[] }>> = {
  bingsu_cafe: { count: 8, samples: ["팥빙수", "망고빙수", "딸기빙수"] },
  cafe: { count: 10, samples: ["아메리카노", "카페라떼", "카페모카"] },
};

interface TemplateLoadDialogProps {
  defaultStoreType?: StoreType;
}

export function TemplateLoadDialog({
  defaultStoreType = "bingsu_cafe",
}: TemplateLoadDialogProps): React.ReactElement {
  const [selected, setSelected] = useState<StoreType>(defaultStoreType);
  const mutation = useCloneTemplate();

  const preview = TEMPLATE_PREVIEWS[selected];
  const isDisabled = !preview || mutation.isPending;

  return (
    <section className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
      <header className="flex flex-col gap-1">
        <h2 className="text-title-md text-ink-1">템플릿으로 빠르게 시작</h2>
        <p className="text-caption text-ink-3">
          가게 유형을 고르면 메뉴와 재료가 자동으로 만들어집니다.
        </p>
      </header>

      <div role="group" aria-label="가게 유형" className="flex gap-stack-tight">
        {STORE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={selected === type}
            onClick={() => setSelected(type)}
            className={cn(
              "flex-1 rounded-md border px-stack py-stack-tight text-body-regular transition",
              selected === type
                ? "border-border-strong bg-ink-1 text-bg"
                : "border-border bg-card text-ink-2 hover:bg-card-hover",
            )}
          >
            {STORE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {preview ? (
        <p className="text-caption text-ink-3">
          메뉴 {preview.count}개 ({preview.samples.join(" · ")} 등)
        </p>
      ) : (
        <p className="text-caption text-ink-3">이 유형은 아직 템플릿이 없어요.</p>
      )}

      <PrimaryButton
        type="button"
        onClick={() => mutation.mutate({ storeType: selected })}
        disabled={isDisabled}
      >
        {mutation.isPending ? "불러오는 중…" : "템플릿 불러오기"}
      </PrimaryButton>

      {mutation.isError && (
        <p role="alert" className="text-caption text-red">
          {mutation.error.message}
        </p>
      )}

      {mutation.isSuccess && mutation.data.newMenuCount === 0 && (
        <p className="text-caption text-ink-3">이미 같은 메뉴가 등록되어 있어요.</p>
      )}
    </section>
  );
}
