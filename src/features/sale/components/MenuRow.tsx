"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";

interface MenuRowProps {
  menu: MenuRowWithRecipe;
  quantity: number;
  onChange: (next: number) => void;
}

export function MenuRow({ menu, quantity, onChange }: MenuRowProps): React.ReactElement {
  const isActive = quantity > 0;

  return (
    <li
      className={cn(
        "glow-panel flex items-center justify-between rounded-[28px] border px-5 py-4 shadow-soft transition",
        isActive
          ? "border-brand-primary/25 bg-white shadow-card ring-1 ring-brand-primary/10"
          : "border-white/70 bg-white/92",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className={cn("text-body font-semibold", isActive ? "text-ink-1" : "text-ink-2")}>
          {menu.name}
        </span>
        <span className="text-caption text-ink-3 tabular-nums">{formatNumber(menu.price)}원</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-1.5 shadow-soft">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity === 0}
          aria-label={`${menu.name} 수량 -1`}
          className="h-11 w-11 rounded-2xl border border-border bg-slate-100 text-title-md font-semibold text-ink-2 shadow-soft transition hover:bg-slate-200 disabled:text-ink-4 disabled:shadow-none"
        >
          −
        </button>

        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={`${menu.name} 수량`}
          value={quantity}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
          }}
          className="w-16 rounded-2xl border border-border bg-white py-2 text-center text-body-regular font-semibold text-ink-1 tabular-nums shadow-soft"
        />

        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          aria-label={`${menu.name} 수량 +1`}
          className="h-11 w-11 rounded-2xl bg-blue text-title-md font-semibold text-white shadow-soft transition hover:bg-blue-deep"
        >
          +
        </button>
      </div>
    </li>
  );
}
