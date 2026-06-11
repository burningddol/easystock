"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatWon } from "@/lib/utils/format";
import { marginTone } from "@/lib/ui/margin-tone";
import { computeMenuMarginFromRow } from "../lib/compute-menu-margin";
import type { MenuRowWithRecipe } from "../hooks/useMenus";

interface MenuListProps {
  menus: readonly MenuRowWithRecipe[];
}

export function MenuList({ menus }: MenuListProps): React.ReactElement {
  return (
    <ul className="flex flex-col gap-stack-tight">
      {menus.map((menu) => (
        <MenuListRow key={menu.id} menu={menu} />
      ))}
    </ul>
  );
}

function MenuListRow({ menu }: { menu: MenuRowWithRecipe }): React.ReactElement {
  const { cost, margin, hasRecipe } = computeMenuMarginFromRow(menu);

  return (
    <li>
      <Link
        href={`/menu/${menu.id}`}
        className="glow-panel flex items-center justify-between rounded-[28px] border border-white/70 bg-white/95 px-5 py-4 shadow-card transition hover:-translate-y-0.5 hover:bg-white"
      >
        <div className="flex flex-col gap-1">
          <span className="text-body font-semibold text-ink-1">{menu.name}</span>
          <span className="text-caption text-ink-3 tabular-nums">
            {formatWon(menu.price)}원
            {hasRecipe && (
              <>
                <span className="text-ink-4"> · </span>
                원가 {formatWon(cost.toNumber())}원
              </>
            )}
          </span>
        </div>
        {hasRecipe ? (
          <MarginChip rate={margin.rate.toNumber()} />
        ) : (
          <span className="text-caption text-ink-3">레시피 미등록</span>
        )}
      </Link>
    </li>
  );
}

/**
 * 디자인 시스템 임계값 (components.md L75-77):
 * - green: 50%+, amber: 30~49%, red: <30%
 */
function MarginChip({ rate }: { rate: number }): React.ReactElement {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-label font-semibold tabular-nums shadow-soft",
        marginToneClass(rate),
      )}
    >
      {rate.toFixed(0)}%
    </span>
  );
}

function marginToneClass(rate: number): string {
  switch (marginTone(rate)) {
    case "green":
      return "bg-emerald-50 text-emerald-700";
    case "amber":
      return "bg-amber-50 text-amber-700";
    case "red":
      return "bg-rose-50 text-rose-700";
  }
}
