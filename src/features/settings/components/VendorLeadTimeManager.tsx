"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import {
  useCreateVendor,
  useUpdateVendorLeadTime,
  useVendors,
  type VendorRow,
} from "@/features/purchase/hooks/useVendors";
import { vendorInputSchema } from "@/features/purchase/schemas";

const vendorLeadTimeSchema = z.object({
  leadTimeDays: z
    .number({ invalid_type_error: "리드타임은 숫자로 입력해주세요" })
    .int("리드타임은 정수여야 합니다")
    .min(0, "리드타임은 0일 이상이어야 합니다"),
});

type VendorLeadTimeInput = z.infer<typeof vendorLeadTimeSchema>;
type VendorCreateInput = z.infer<typeof vendorInputSchema>;

export function VendorLeadTimeManager(): React.ReactElement {
  const router = useRouter();
  const { data: vendors, isLoading, error } = useVendors();
  const createMutation = useCreateVendor();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const sortedVendors = useMemo(
    () => [...(vendors ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [vendors],
  );
  const filteredVendors = useMemo(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase();

    if (!keyword) return sortedVendors;

    return sortedVendors.filter((vendor) => vendor.name.toLowerCase().includes(keyword));
  }, [deferredSearchTerm, sortedVendors]);
  const visibleVendors = filteredVendors.slice(0, visibleCount);
  const hasMore = filteredVendors.length > visibleCount;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorCreateInput>({
    resolver: zodResolver(vendorInputSchema),
    defaultValues: { name: "", leadTimeDays: 1 },
  });

  async function onCreate(values: VendorCreateInput): Promise<void> {
    setSubmitMessage(null);

    try {
      await createMutation.mutateAsync(values);
      reset({ name: "", leadTimeDays: 1 });
      setSubmitMessage("거래처를 추가했어요.");
      router.refresh();
    } catch (createError) {
      setSubmitMessage(
        createError instanceof Error ? createError.message : "거래처 추가에 실패했어요.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-stack rounded-md border border-border bg-bg p-stack">
      <div className="flex flex-wrap items-start justify-between gap-stack-tight">
        <div className="flex flex-col gap-1">
          <p className="text-label text-ink-2">거래처 리드타임 관리</p>
          <p className="text-caption text-ink-3">
            예측 계산에 쓰는 거래처 리드타임을 여기서 바로 수정할 수 있어요. 저장하면 재고 소진
            예측과 대시보드가 함께 갱신됩니다.
          </p>
          <p className="text-caption text-ink-3">
            현재 거래처 {sortedVendors.length}개가 등록되어 있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {isExpanded ? "접기" : `거래처 ${sortedVendors.length}개 관리`}
        </button>
      </div>

      {isLoading && <p className="text-caption text-ink-3">거래처를 불러오는 중...</p>}
      {error && (
        <p role="alert" className="text-caption text-red">
          {error.message}
        </p>
      )}

      {!isLoading && !error && isExpanded && (
        <>
          {sortedVendors.length > 0 ? (
            <div className="flex flex-col gap-stack-tight">
              <Field label="거래처 검색">
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setVisibleCount(6);
                  }}
                  type="text"
                  placeholder="거래처 이름으로 찾기"
                  className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
                />
              </Field>

              {filteredVendors.length > 0 ? (
                <>
                  {visibleVendors.map((vendor) => (
                    <VendorLeadTimeRow key={vendor.id} vendor={vendor} />
                  ))}

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((count) => count + 10)}
                      className={SECONDARY_BUTTON_CLASSES}
                    >
                      거래처 더 보기
                    </button>
                  )}
                </>
              ) : (
                <div className="rounded-md border border-dashed border-border px-stack py-stack-tight">
                  <p className="text-body-regular text-ink-1">검색 결과가 없어요.</p>
                  <p className="mt-1 text-caption text-ink-3">
                    다른 이름으로 검색하거나 아래에서 새 거래처를 추가해보세요.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border px-stack py-stack-tight">
              <p className="text-body-regular text-ink-1">아직 등록된 거래처가 없어요.</p>
              <p className="mt-1 text-caption text-ink-3">
                아래에서 거래처를 추가하면 앞으로 예측 계산에 바로 반영됩니다.
              </p>
            </div>
          )}
        </>
      )}

      <form
        onSubmit={(event) => void handleSubmit(onCreate)(event)}
        className="flex flex-col gap-stack rounded-md border border-border bg-card p-stack"
        noValidate
      >
        <div className="flex items-center justify-between gap-stack-tight">
          <h3 className="text-body-semibold text-ink-1">새 거래처 추가</h3>
          <span className="text-caption text-ink-3">예측 기본값은 1일</span>
        </div>

        <div className="grid gap-stack-tight md:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="거래처 이름" error={errors.name?.message}>
            <input
              {...register("name")}
              type="text"
              className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
            />
          </Field>

          <Field label="리드타임 (일)" error={errors.leadTimeDays?.message}>
            <input
              {...register("leadTimeDays", { valueAsNumber: true })}
              type="number"
              min={0}
              inputMode="numeric"
              className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
            />
          </Field>
        </div>

        <div className="flex items-center gap-stack-tight">
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? "추가 중..." : "거래처 추가"}
          </PrimaryButton>
          {submitMessage && (
            <p
              role="status"
              className={
                createMutation.isError ? "text-caption text-red" : "text-caption text-green"
              }
            >
              {submitMessage}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function VendorLeadTimeRow({ vendor }: { vendor: VendorRow }): React.ReactElement {
  const router = useRouter();
  const mutation = useUpdateVendorLeadTime();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<VendorLeadTimeInput>({
    resolver: zodResolver(vendorLeadTimeSchema),
    defaultValues: { leadTimeDays: vendor.lead_time_days },
  });

  async function onSubmit(values: VendorLeadTimeInput): Promise<void> {
    setSubmitMessage(null);

    try {
      const updated = await mutation.mutateAsync({
        vendorId: vendor.id,
        leadTimeDays: values.leadTimeDays,
      });
      reset({ leadTimeDays: updated.lead_time_days });
      setSubmitMessage("저장했어요.");
      router.refresh();
    } catch (updateError) {
      setSubmitMessage(
        updateError instanceof Error ? updateError.message : "리드타임 저장에 실패했어요.",
      );
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="grid gap-stack-tight rounded-md border border-border bg-card p-stack md:grid-cols-[minmax(0,1fr)_140px_auto]"
      noValidate
    >
      <div className="flex flex-col justify-center">
        <p className="text-body-semibold text-ink-1">{vendor.name}</p>
        <p className="text-caption text-ink-3">
          이 거래처를 쓰는 최근 구매 이력 재료 예측에 반영됩니다.
        </p>
      </div>

      <Field label="리드타임 (일)" error={errors.leadTimeDays?.message}>
        <input
          {...register("leadTimeDays", { valueAsNumber: true })}
          type="number"
          min={0}
          inputMode="numeric"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1 tabular-nums"
        />
      </Field>

      <div className="flex flex-col justify-end gap-stack-tight">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {isSubmitting ? "저장 중..." : "저장"}
        </button>
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
