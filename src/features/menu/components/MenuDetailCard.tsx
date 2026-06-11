"use client";

import { MARGIN_LABEL } from "@/lib/domain/margin";
import { formatWon } from "@/lib/utils/format";
import { computeMenuMarginFromRow } from "../lib/compute-menu-margin";
import type { MenuRowWithRecipe } from "../hooks/useMenus";

interface MenuDetailCardProps {
  menu: MenuRowWithRecipe;
}

export function MenuDetailCard({ menu }: MenuDetailCardProps): React.ReactElement {
  const { cost, margin, hasRecipe } = computeMenuMarginFromRow(menu);

  return (
    <article className="glow-panel flex flex-col gap-section rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-card">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Menu Detail
          </span>
          <h2 className="text-title-md text-ink-1">{menu.name}</h2>
          <span className="text-caption text-ink-3 tabular-nums">
            판매가 {formatWon(menu.price)}원
          </span>
        </div>
        {hasRecipe ? (
          <div className="rounded-3xl bg-brand-primary/8 px-4 py-3 text-right shadow-soft">
            <span className="text-metric-lg text-brand-primary tabular-nums">
              {margin.rate.toFixed(0)}%
            </span>
            <span className="block text-caption text-brand-primary/80">마진율</span>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-caption text-ink-3">
            레시피 미등록
          </span>
        )}
      </header>

      {hasRecipe && (
        <ul className="flex flex-col gap-3">
          {menu.recipe_items.map((item) => (
            <RecipeRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {hasRecipe && (
        <footer className="rounded-3xl bg-slate-50/90 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-caption text-ink-3">{MARGIN_LABEL}</span>
              <span className="text-body-regular text-ink-2 tabular-nums">
                마진 금액 {formatWon(margin.amount.toNumber())}원
              </span>
            </div>
            <span className="text-metric-md text-ink-1 tabular-nums">
              원가 {formatWon(cost.toNumber())}원
            </span>
          </div>
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
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-stack rounded-3xl bg-slate-50/85 px-4 py-3">
      <span className="text-body-regular text-ink-1">{item.ingredient.name}</span>
      <span className="text-caption text-ink-3 tabular-nums">
        {item.quantity_per_serving}
        {item.ingredient.unit}
      </span>
      <span className="text-body-regular text-ink-2 tabular-nums">{formatWon(lineCost)}원</span>
    </li>
  );
}
