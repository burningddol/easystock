"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useUpdateSafetyBufferDays } from "@/features/settings/hooks/useSettingsMutations";

const safetyBufferSchema = z.object({
  safetyBufferDays: z
    .number({ invalid_type_error: "안전여유일은 숫자로 입력해주세요" })
    .int("안전여유일은 정수여야 합니다")
    .min(0, "안전여유일은 0일 이상이어야 합니다")
    .max(7, "안전여유일은 7일 이하로 입력해주세요"),
});

type SafetyBufferFormInput = z.infer<typeof safetyBufferSchema>;

interface SafetyBufferEditorProps {
  initialSafetyBufferDays: number;
  userId: string;
}

export function SafetyBufferEditor({
  initialSafetyBufferDays,
  userId,
}: SafetyBufferEditorProps): React.ReactElement {
  const router = useRouter();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const mutation = useUpdateSafetyBufferDays();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<SafetyBufferFormInput>({
    resolver: zodResolver(safetyBufferSchema),
    defaultValues: { safetyBufferDays: initialSafetyBufferDays },
  });

  async function onSubmit(values: SafetyBufferFormInput): Promise<void> {
    setSubmitMessage(null);

    try {
      const nextValue = await mutation.mutateAsync({
        userId,
        safetyBufferDays: values.safetyBufferDays,
      });
      reset({ safetyBufferDays: nextValue });
      setSubmitMessage("예측 안전여유일을 저장했어요.");
      router.refresh();
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "안전여유일 저장에 실패했어요.");
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-stack"
      noValidate
    >
      <Field label="안전여유일" error={errors.safetyBufferDays?.message}>
        <input
          {...register("safetyBufferDays", { valueAsNumber: true })}
          type="number"
          min={0}
          max={7}
          inputMode="numeric"
          className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 tabular-nums shadow-soft"
        />
      </Field>

      <p className="text-caption text-ink-3">
        소진일까지 남은 일수에서 거래처 리드타임과 이 값을 함께 빼서 위험 단계를 정합니다.
      </p>

      <div className="flex items-center gap-stack-tight">
        <PrimaryButton type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "저장 중..." : "안전여유일 저장"}
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
