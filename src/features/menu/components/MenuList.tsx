"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatWon } from "@/lib/utils/format";
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
        className="flex items-center justify-between rounded-lg border border-border bg-card px-tile py-stack hover:bg-card-hover"
      >
        <div className="flex flex-col gap-1">
          <span className="text-body text-ink-1">{menu.name}</span>
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
    <span className={cn("rounded-full px-3 py-1 text-label tabular-nums", marginToneClass(rate))}>
      {rate.toFixed(0)}%
    </span>
  );
}

function marginToneClass(rate: number): string {
  if (rate >= 50) return "bg-green-soft text-green-deep";
  if (rate >= 30) return "bg-amber-soft text-amber-deep";
  return "bg-red-soft text-red-deep";
}
