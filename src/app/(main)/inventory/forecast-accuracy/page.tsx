"use client";

import Link from "next/link";
import { MenuForecastAccuracyList } from "@/features/inventory/components/MenuForecastAccuracyList";
import { useMenuForecastAccuracy } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

export default function ForecastAccuracyPage(): React.ReactElement {
  const query = useMenuForecastAccuracy();

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="예측 정확도"
        action={
          <Link href="/inventory/menu-forecast" className={SECONDARY_BUTTON_CLASSES}>
            메뉴 예측
          </Link>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">
          최근 14일 기준으로 메뉴 예측과 실제 판매량을 비교합니다.
        </p>
        <p className="mt-1 text-caption text-ink-3">
          각 날짜의 예측은 그 전날까지의 판매 이력만 사용해 다시 계산합니다.
        </p>
      </section>

      {query.isLoading && <LoadingText />}
      {query.error && <ErrorAlert message={query.error.message} />}
      {query.data && <MenuForecastAccuracyList items={query.data} />}
    </section>
  );
}
