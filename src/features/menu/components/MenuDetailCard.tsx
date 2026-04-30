"use client";

import { MARGIN_LABEL } from "@/lib/domain/margin";
import { computeMenuMarginFromRow } from "../lib/compute-menu-margin";
import type { MenuRowWithRecipe } from "../hooks/useMenus";

interface MenuDetailCardProps {
  menu: MenuRowWithRecipe;
}

const fmt = (value: number): string => Math.round(value).toLocaleString("ko-KR");

export function MenuDetailCard({ menu }: MenuDetailCardProps): React.ReactElement {
  const { cost, margin, hasRecipe } = computeMenuMarginFromRow(menu);

  return (
    <article className="flex flex-col gap-section rounded-lg border border-border bg-card p-tile">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-md text-ink-1">{menu.name}</h2>
          <span className="text-caption text-ink-3 tabular-nums">판매가 {fmt(menu.price)}원</span>
        </div>
        {hasRecipe ? (
          <div className="flex flex-col items-end gap-1">
            <span className="text-metric-lg text-ink-1 tabular-nums">
              {margin.rate.toFixed(0)}%
            </span>
            <span className="text-caption text-ink-3">마진율</span>
          </div>
        ) : (
          <span className="text-caption text-ink-3">레시피 미등록</span>
        )}
      </header>

      {hasRecipe && (
        <ul className="flex flex-col divide-y divide-border">
          {menu.recipe_items.map((item) => (
            <RecipeRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {hasRecipe && (
        <footer className="flex items-baseline justify-between border-t border-border pt-stack">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-ink-3">{MARGIN_LABEL}</span>
            <span className="text-body-regular text-ink-2 tabular-nums">
              마진 금액 {fmt(margin.amount.toNumber())}원
            </span>
          </div>
          <span className="text-metric-md text-ink-1 tabular-nums">
            원가 {fmt(cost.toNumber())}원
          </span>
        </footer>
      )}
    </article>
  );
}

function RecipeRow({
  item,
}: {
  item: MenuRowWithRecipe["recipe_items"][number];
}): React.ReactElement {
  const lineCost = item.quantity_per_serving * item.ingredient.current_avg_price;

  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-stack py-stack-tight">
      <span className="text-body-regular text-ink-1">{item.ingredient.name}</span>
      <span className="text-caption text-ink-3 tabular-nums">
        {item.quantity_per_serving}
        {item.ingredient.unit}
      </span>
      <span className="text-body-regular text-ink-2 tabular-nums">{fmt(lineCost)}원</span>
    </li>
  );
}
