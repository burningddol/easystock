"use client";

import Link from "next/link";
import { IngredientForecastAccuracyList } from "@/features/inventory/components/IngredientForecastAccuracyList";
import { MenuForecastAccuracyList } from "@/features/inventory/components/MenuForecastAccuracyList";
import { useIngredientForecastAccuracy } from "@/features/inventory/hooks/useIngredientForecastAccuracy";
import { useMenuForecastAccuracy } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

export default function ForecastAccuracyPage(): React.ReactElement {
  const menuQuery = useMenuForecastAccuracy();
  const ingredientQuery = useIngredientForecastAccuracy();

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
          최근 14일 기준으로 메뉴·재료 예측과 실제 판매/소비량을 비교합니다.
        </p>
        <p className="mt-1 text-caption text-ink-3">
          각 날짜의 예측은 그 전날까지의 판매 이력만 사용해 다시 계산합니다.
        </p>
      </section>

      <AccuracySection title="재료 예측 정확도">
        {ingredientQuery.isLoading && <LoadingText />}
        {ingredientQuery.error && <ErrorAlert message={ingredientQuery.error.message} />}
        {ingredientQuery.data && <IngredientForecastAccuracyList items={ingredientQuery.data} />}
      </AccuracySection>

      <AccuracySection title="메뉴 예측 정확도">
        {menuQuery.isLoading && <LoadingText />}
        {menuQuery.error && <ErrorAlert message={menuQuery.error.message} />}
        {menuQuery.data && <MenuForecastAccuracyList items={menuQuery.data} />}
      </AccuracySection>
    </section>
  );
}

function AccuracySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-stack-tight">
      <h2 className="text-title-md text-ink-1">{title}</h2>
      {children}
    </section>
  );
}
