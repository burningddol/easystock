"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/features/auth/schemas";
import { useUpdateRegularDaysOff } from "@/features/settings/hooks/useSettingsMutations";
import type { Weekday } from "@/lib/domain/regular-days-off";
import { cn } from "@/lib/utils";

interface RegularDaysOffEditorProps {
  initialDaysOff: readonly Weekday[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function RegularDaysOffEditor({
  initialDaysOff,
}: RegularDaysOffEditorProps): React.ReactElement {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<Weekday>>(() => new Set(initialDaysOff));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useUpdateRegularDaysOff();

  // 빠른 연속 토글 시 늦게 도착한 응답이 최신 상태를 덮어쓰지 않도록 monotonic id로 가드.
  const latestRequestId = useRef(0);

  function handleToggle(day: Weekday): void {
    const next = new Set(selected);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    setSelected(next);
    void persist(next);
  }

  async function persist(next: Set<Weekday>): Promise<void> {
    const requestId = ++latestRequestId.current;
    setStatus("saving");
    setErrorMessage(null);

    const payload = WEEKDAYS.filter((d) => next.has(d));
    try {
      await mutation.mutateAsync({ daysOff: payload });
    } catch (error) {
      if (requestId !== latestRequestId.current) return;
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류");
      return;
    }

    if (requestId !== latestRequestId.current) return;

    setStatus("saved");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-stack">
      <header className="flex flex-col gap-stack-tight">
        <h2 className="text-title-md text-ink-1">정기휴무</h2>
        <p className="text-caption text-ink-3">
          쉬는 요일을 선택하세요. 누락 알림과 평균 산정에서 제외됩니다.
        </p>
      </header>

      <div role="group" aria-label="정기휴무 요일" className="flex flex-wrap gap-stack-tight">
        {WEEKDAYS.map((day) => {
          const active = selected.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={active}
              onClick={() => handleToggle(day)}
              className={cn(
                "h-11 min-w-11 rounded-full border px-4 text-body transition",
                active
                  ? "border-border-strong bg-ink-1 text-bg"
                  : "border-border bg-card text-ink-2 hover:bg-card-hover",
              )}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          );
        })}
      </div>

      <SaveStatusLine status={status} errorMessage={errorMessage} count={selected.size} />
    </section>
  );
}

interface SaveStatusLineProps {
  status: SaveStatus;
  errorMessage: string | null;
  count: number;
}

function SaveStatusLine({ status, errorMessage, count }: SaveStatusLineProps): React.ReactElement {
  if (status === "saving") {
    return <p className="text-caption text-ink-3">저장 중…</p>;
  }
  if (status === "error") {
    return <p className="text-caption text-red">저장 실패: {errorMessage ?? "알 수 없는 오류"}</p>;
  }
  if (status === "saved") {
    return <p className="text-caption text-green">저장됨</p>;
  }
  return (
    <p className="text-caption text-ink-3">{count === 0 ? "365일 영업" : `주 ${count}회 휴무`}</p>
  );
}
