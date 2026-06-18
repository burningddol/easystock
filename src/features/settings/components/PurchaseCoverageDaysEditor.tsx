"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useUpdatePurchaseCoverageDays } from "@/features/settings/hooks/useSettingsMutations";

const purchaseCoverageSchema = z.object({
  purchaseCoverageDays: z
    .number({ invalid_type_error: "발주 커버일은 숫자로 입력해주세요" })
    .int("발주 커버일은 정수여야 합니다")
    .min(1, "발주 커버일은 1일 이상이어야 합니다")
    .max(30, "발주 커버일은 30일 이하로 입력해주세요"),
});

type PurchaseCoverageFormInput = z.infer<typeof purchaseCoverageSchema>;

interface PurchaseCoverageDaysEditorProps {
  initialPurchaseCoverageDays: number;
  userId: string;
}

export function PurchaseCoverageDaysEditor({
  initialPurchaseCoverageDays,
  userId,
}: PurchaseCoverageDaysEditorProps): React.ReactElement {
  const router = useRouter();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const mutation = useUpdatePurchaseCoverageDays();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<PurchaseCoverageFormInput>({
    resolver: zodResolver(purchaseCoverageSchema),
    defaultValues: { purchaseCoverageDays: initialPurchaseCoverageDays },
  });

  async function onSubmit(values: PurchaseCoverageFormInput): Promise<void> {
    setSubmitMessage(null);

    try {
      const nextValue = await mutation.mutateAsync({
        userId,
        purchaseCoverageDays: values.purchaseCoverageDays,
      });
      reset({ purchaseCoverageDays: nextValue });
      setSubmitMessage("권장 발주 커버일을 저장했어요.");
      router.refresh();
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "발주 커버일 저장에 실패했어요.");
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-stack"
      noValidate
    >
      <Field label="권장 발주 커버일" error={errors.purchaseCoverageDays?.message}>
        <input
          {...register("purchaseCoverageDays", { valueAsNumber: true })}
          type="number"
          min={1}
          max={30}
          inputMode="numeric"
          className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 tabular-nums shadow-soft"
        />
      </Field>

      <p className="text-caption text-ink-3">
        발주 추천 수량은 리드타임과 안전여유를 버틴 뒤, 이 일수만큼 더 운영할 수 있게 계산합니다.
      </p>

      <div className="flex items-center gap-stack-tight">
        <PrimaryButton type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "저장 중..." : "발주 커버일 저장"}
        </PrimaryButton>
        {submitMessage && (
          <p
            role="status"
            className={mutation.isError ? "text-caption text-red" : "text-caption text-green"}
          >
            {submitMessage}
          </p>
        )}
      </div>
    </form>
  );
}
