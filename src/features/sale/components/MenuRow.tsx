"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import type { SaleDraftOptionItem } from "@/stores/sale-draft";

interface MenuRowProps {
  menu: MenuRowWithRecipe;
  quantity: number;
  onChange: (next: number) => void;
  optionSelections?: readonly SaleDraftOptionItem[];
  onOptionChange?: (groupId: string, optionValueId: string, quantity: number) => void;
}

export function MenuRow({
  menu,
  quantity,
  onChange,
  optionSelections = [],
  onOptionChange,
}: MenuRowProps): React.ReactElement {
  const isActive = quantity > 0;
  const hasOptionControls = menu.option_groups.length > 0 && onOptionChange !== undefined;
  const selectedOptionByValue = new Map(optionSelections.map((item) => [item.optionValueId, item]));
  const showOptions = hasOptionControls;
  const [open, setOpen] = useState(showOptions);

  useEffect(() => {
    if (showOptions) setOpen(true);
  }, [showOptions]);

  return (
    <li
      className={cn(
        "glow-panel flex flex-col gap-4 rounded-[28px] border px-5 py-4 shadow-soft transition",
        isActive
          ? "border-brand-primary/25 bg-white shadow-card ring-1 ring-brand-primary/10"
          : "border-white/70 bg-white/92",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-body font-semibold", isActive ? "text-ink-1" : "text-ink-2")}>
              {menu.name}
            </span>
            {hasOptionControls && (
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="rounded-full border border-border bg-white px-2 py-1 text-[11px] text-ink-3 hover:text-ink-2"
              >
                {open ? "옵션 닫기" : "옵션 보기"}
              </button>
            )}
          </div>
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
      </div>

      {showOptions && open && (
        <div className="mt-4 flex flex-col gap-3 rounded-3xl bg-slate-50/90 p-4">
          <p className="text-[11px] text-ink-3">
            판매 수량을 입력하면 아래 옵션을 같이 고를 수 있어요. 택1형은 메뉴 수량만큼 정확히
            맞춰야 합니다.
          </p>
          {menu.option_groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-caption font-semibold text-ink-2">{group.name}</span>
                  <span className="text-[11px] text-ink-3">
                    {group.selection_type === "single" ? "택1형" : "추가형"} ·{" "}
                    {group.is_required ? "필수" : "선택"} · 선택 수량은 판매 수량 기준
                  </span>
                </div>
                <span className="text-[11px] text-ink-3">
                  {quantity > 0 ? `판매 ${quantity}개` : "수량을 먼저 입력"}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {group.values.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-border bg-white/70 px-3 py-3 text-[11px] text-ink-3">
                    이 그룹에는 아직 선택지가 없어요. 메뉴 수정에서 옵션값을 추가해야 판매 입력에
                    선택 버튼이 생깁니다.
                  </p>
                )}
                {group.values.map((value) => {
                  const current = selectedOptionByValue.get(value.id)?.quantity ?? 0;
                  return (
                    <div
                      key={value.id}
                      className={cn(
                        "grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-2",
                        current > 0
                          ? "border-brand-primary/20 bg-white"
                          : "border-white bg-white/80",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-body-regular text-ink-1">{value.name}</span>
                        <span className="text-[11px] text-ink-3 tabular-nums">
                          +{formatNumber(value.price_delta)}원
                        </span>
                      </div>

                      <div className="flex items-center gap-1 rounded-2xl border border-border bg-white p-1">
                        <button
                          type="button"
                          onClick={() =>
                            onOptionChange?.(group.id, value.id, Math.max(0, current - 1))
                          }
                          disabled={current === 0 || quantity === 0}
                          className="h-9 w-9 rounded-xl border border-border bg-slate-100 text-ink-2 disabled:opacity-40"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={quantity > 0 ? quantity : undefined}
                          value={current}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            onOptionChange?.(
                              group.id,
                              value.id,
                              Number.isFinite(next) && next >= 0 ? Math.floor(next) : 0,
                            );
                          }}
                          className="w-14 rounded-xl border border-border bg-white py-2 text-center text-caption font-semibold text-ink-1 tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => onOptionChange?.(group.id, value.id, current + 1)}
                          disabled={quantity === 0}
                          className="h-9 w-9 rounded-xl bg-blue text-white disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
