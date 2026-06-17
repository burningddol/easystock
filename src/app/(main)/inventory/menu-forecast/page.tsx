"use client";

import Link from "next/link";
import { MenuDemandForecastList } from "@/features/inventory/components/MenuDemandForecastList";
import { useMenuDemandForecast } from "@/features/inventory/hooks/useMenuDemandForecast";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

export default function MenuForecastPage(): React.ReactElement {
  const query = useMenuDemandForecast();

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="메뉴 수요 예측"
        action={
          <Link href="/inventory" className={SECONDARY_BUTTON_CLASSES}>
            재료 예측
          </Link>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">앞으로 7일간 메뉴별 예상 판매량을 보여줍니다.</p>
        <p className="mt-1 text-caption text-ink-3">
          재료 소진 예측은 이 메뉴 수요와 옵션 선택률을 재료 레시피로 변환해서 계산합니다.
        </p>
      </section>

      {query.isLoading && <LoadingText />}
      {query.error && <ErrorAlert message={query.error.message} />}
      {query.data && <MenuDemandForecastList items={query.data} />}
    </section>
  );
}
