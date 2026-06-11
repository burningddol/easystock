"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useUpdateStoreName } from "@/features/settings/hooks/useSettingsMutations";

const storeNameSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1, "가게 이름을 입력해주세요")
    .max(50, "가게 이름은 50자 이내로 입력해주세요"),
});

type StoreNameFormInput = z.infer<typeof storeNameSchema>;

interface StoreNameEditorProps {
  initialStoreName: string;
  userId: string;
}

export function StoreNameEditor({
  initialStoreName,
  userId,
}: StoreNameEditorProps): React.ReactElement {
  const router = useRouter();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const mutation = useUpdateStoreName();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<StoreNameFormInput>({
    resolver: zodResolver(storeNameSchema),
    defaultValues: { storeName: initialStoreName },
  });

  async function onSubmit(values: StoreNameFormInput): Promise<void> {
    setSubmitMessage(null);

    try {
      const nextStoreName = await mutation.mutateAsync({
        userId,
        storeName: values.storeName.trim(),
      });
      reset({ storeName: nextStoreName });
      setSubmitMessage("가게 이름을 저장했어요.");
      router.refresh();
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "가게 이름 저장에 실패했어요.");
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-stack"
      noValidate
    >
      <Field label="가게 이름" error={errors.storeName?.message}>
        <input
          {...register("storeName")}
          type="text"
          maxLength={50}
          className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 shadow-soft"
        />
      </Field>

      <div className="flex items-center gap-stack-tight">
        <PrimaryButton type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "저장 중..." : "가게 이름 저장"}
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
