"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ForecastPeriodSelector } from "@/features/inventory/components/ForecastPeriodSelector";
import { MenuDemandForecastList } from "@/features/inventory/components/MenuDemandForecastList";
import { useMenuDemandForecast } from "@/features/inventory/hooks/useMenuDemandForecast";
import { useMenuForecastAccuracy } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

const HORIZON_OPTIONS = [7, 14, 30] as const;

export default function MenuForecastPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingText />}>
      <MenuForecastContent />
    </Suspense>
  );
}

function MenuForecastContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const horizonDays = parseOption(searchParams.get("horizon"), HORIZON_OPTIONS, 7);
  const query = useMenuDemandForecast(horizonDays);
  const accuracyQuery = useMenuForecastAccuracy(14);

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="메뉴 수요 예측"
        action={
          <div className="flex gap-stack-tight">
            <Link href="/inventory/forecast-accuracy?tab=menu" className={SECONDARY_BUTTON_CLASSES}>
              정확도
            </Link>
            <Link href="/inventory/forecast?tab=ingredient" className={SECONDARY_BUTTON_CLASSES}>
              재료 예측
            </Link>
          </div>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">
          앞으로 {horizonDays}일간 메뉴별 예상 판매량을 보여줍니다.
        </p>
        <p className="mt-1 text-caption text-ink-3">
          재료 소진 예측은 이 메뉴 수요와 옵션 선택률을 재료 레시피로 변환해서 계산합니다.
        </p>
        {horizonDays > 7 && (
          <p className="mt-3 rounded-2xl border border-amber-soft bg-amber-soft/50 px-3 py-2 text-caption text-amber-deep">
            14일·30일 예측은 같은 요일 패턴을 반복한 참고용입니다. 실제 발주 판단은 최근 7일 단기
            예측과 재고 상태를 함께 확인하세요.
          </p>
        )}
      </section>

      <ForecastPeriodSelector
        label="예측 기간"
        queryKey="horizon"
        selectedValue={horizonDays}
        options={HORIZON_OPTIONS}
        suffix="일"
        pathname="/inventory/forecast"
        extraParams={{ tab: "menu" }}
      />

      {query.isLoading && <LoadingText />}
      {query.error && <ErrorAlert message={query.error.message} />}
      {query.data && (
        <MenuDemandForecastList items={query.data} accuracyItems={accuracyQuery.data ?? []} />
      )}
    </section>
  );
}

function parseOption<T extends number>(raw: string | null, options: readonly T[], fallback: T): T {
  const value = Number(raw);
  return options.includes(value as T) ? (value as T) : fallback;
}
