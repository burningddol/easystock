"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { vendorInputSchema, type VendorInput } from "../schemas";
import { useCreateVendor, type VendorRow } from "../hooks/useVendors";

interface VendorQuickCreateProps {
  onCreated: (vendor: VendorRow) => void;
  onCancel: () => void;
}

export function VendorQuickCreate({
  onCreated,
  onCancel,
}: VendorQuickCreateProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateVendor();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VendorInput>({
    resolver: zodResolver(vendorInputSchema),
    defaultValues: { name: "", leadTimeDays: 1 },
  });

  async function onSubmit(values: VendorInput): Promise<void> {
    setError(null);
    try {
      const created = await mutation.mutateAsync(values);
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "거래처 생성 실패");
    }
  }

  // 중첩 <form>은 invalid HTML — 외부 PurchaseForm 안에 들어가므로 <div>로 렌더하고
  // 추가 버튼은 type="button" + handleSubmit() 직접 호출.
  return (
    <div className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
      <h3 className="text-title-md text-ink-1">새 거래처 추가</h3>

      <Field label="거래처 이름" error={errors.name?.message}>
        <input
          {...register("name")}
          type="text"
          autoFocus
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="리드타임 (일)" error={errors.leadTimeDays?.message}>
        <input
          {...register("leadTimeDays", { valueAsNumber: true })}
          type="number"
          min={0}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
        />
      </Field>

      {error && (
        <p role="alert" className="text-caption text-red">
          {error}
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
