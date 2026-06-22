"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ForecastSensitivity } from "@/lib/domain/forecast";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useUpdateForecastSensitivity } from "@/features/settings/hooks/useSettingsMutations";

interface ForecastSensitivityEditorProps {
  initialForecastSensitivity: ForecastSensitivity;
  userId: string;
}

const OPTIONS: Array<{
  value: ForecastSensitivity;
  label: string;
  description: string;
  details: string[];
}> = [
  {
    value: "stable",
    label: "안정적",
    description: "최근 변동을 천천히 반영합니다. 과발주를 줄이고 싶은 매장에 적합합니다.",
    details: ["최근 21일 흐름을 완만하게 반영", "요일별 데이터 prior 16", "이상치 영향 2.5배 cap"],
  },
  {
    value: "balanced",
    label: "기본",
    description: "최근 흐름과 장기 평균을 균형 있게 반영합니다.",
    details: ["최근 14일 흐름을 표준 반영", "요일별 데이터 prior 12", "이상치 영향 3배 cap"],
  },
  {
    value: "responsive",
    label: "민감",
    description: "최근 판매 변화를 빠르게 반영합니다. 날씨나 이벤트 영향이 큰 매장에 적합합니다.",
    details: ["최근 7일 흐름을 빠르게 반영", "요일별 데이터 prior 8", "이상치 영향 4배 cap"],
  },
];

export function ForecastSensitivityEditor({
  initialForecastSensitivity,
  userId,
}: ForecastSensitivityEditorProps): React.ReactElement {
  const router = useRouter();
  const [value, setValue] = useState<ForecastSensitivity>(initialForecastSensitivity);
  const [savedValue, setSavedValue] = useState<ForecastSensitivity>(initialForecastSensitivity);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const mutation = useUpdateForecastSensitivity();
  const isDirty = value !== savedValue;

  async function handleSubmit(): Promise<void> {
    setSubmitMessage(null);

    try {
      const nextValue = await mutation.mutateAsync({
        userId,
        forecastSensitivity: value,
      });
      setValue(nextValue);
      setSavedValue(nextValue);
      setSubmitMessage("예측 민감도를 저장했어요.");
      router.refresh();
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "예측 민감도 저장에 실패했어요.");
    }
  }

  return (
    <section className="flex flex-col gap-stack">
      <div>
        <p className="text-label text-ink-2">예측 민감도</p>
        <p className="mt-1 text-caption text-ink-3">
          최근 판매 변화를 예측에 얼마나 빠르게 반영할지 정합니다. 모든 모드는 개별요일 반영을 최대
          85%로 제한하고, 월~목/금/주말 그룹 평균을 안정화 기준으로 남깁니다.
        </p>
      </div>

      <div className="grid gap-stack-tight md:grid-cols-3">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setValue(option.value)}
              className={cn(
                "rounded-2xl border px-stack py-stack text-left shadow-soft transition",
                selected
                  ? "border-blue bg-blue-soft text-blue-deep"
                  : "border-border bg-card text-ink-2 hover:bg-card-hover",
              )}
              aria-pressed={selected}
            >
              <span className="block text-body font-semibold">{option.label}</span>
              <span className="mt-1 block text-caption">{option.description}</span>
              <span className="mt-3 flex flex-col gap-1 text-micro opacity-80">
                {option.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-bg px-stack py-stack text-caption text-ink-3">
        <p className="font-semibold text-ink-2">신뢰도 표시는 이렇게 계산돼요</p>
        <p className="mt-1">
          판매 데이터 일수와 개별요일 보정 비율을 함께 보고 `신뢰도 높음/보통/낮음/수집 중`으로
          표시합니다. 데이터가 적으면 같은 요일 평균만 믿지 않고 그룹 평균 쪽으로 당깁니다.
        </p>
      </div>

      <div className="flex items-center gap-stack-tight">
        <PrimaryButton
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!isDirty || mutation.isPending}
        >
          {mutation.isPending ? "저장 중..." : "예측 민감도 저장"}
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
    </section>
  );
}
