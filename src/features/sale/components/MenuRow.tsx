"use client";

import { cn } from "@/lib/utils";
import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";

interface MenuRowProps {
  menu: MenuRowWithRecipe;
  quantity: number;
  onChange: (next: number) => void;
}

const fmt = (n: number): string => n.toLocaleString("ko-KR");

export function MenuRow({ menu, quantity, onChange }: MenuRowProps): React.ReactElement {
  const active = quantity > 0;

  return (
    <li
      className={cn(
        "flex items-center justify-between rounded-lg border px-tile py-stack",
        active ? "border-border-strong bg-card" : "border-border bg-card",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className={cn("text-body", active ? "text-ink-1" : "text-ink-2")}>{menu.name}</span>
        <span className="text-caption text-ink-3 tabular-nums">{fmt(menu.price)}원</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, quantity - 1))}
          disabled={quantity === 0}
          aria-label={`${menu.name} 수량 -1`}
          className="h-11 w-11 rounded-md border border-border bg-card text-title-md text-ink-2 hover:bg-card-hover disabled:opacity-40"
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
          className="w-14 rounded-md border border-border bg-card py-2 text-center text-body-regular text-ink-1 tabular-nums"
        />

        <button
          type="button"
          onClick={() => onChange(quantity + 1)}
          aria-label={`${menu.name} 수량 +1`}
          className="h-11 w-11 rounded-md bg-ink-1 text-title-md text-bg hover:opacity-90"
        >
          +
        </button>
      </div>
    </li>
  );
}
