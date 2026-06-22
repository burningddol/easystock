"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ForecastPeriodSelectorProps {
  label: string;
  queryKey: string;
  selectedValue: number;
  options: readonly number[];
  suffix: string;
  pathname: string;
  extraParams?: Record<string, string>;
}

export function ForecastPeriodSelector({
  label,
  queryKey,
  selectedValue,
  options,
  suffix,
  pathname,
  extraParams,
}: ForecastPeriodSelectorProps): React.ReactElement {
  return (
    <div className="rounded-[24px] border border-border bg-card px-4 py-4 shadow-soft">
      <p className="text-caption font-semibold text-ink-2">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === selectedValue;
          return (
            <Link
              key={option}
              href={buildHref(pathname, queryKey, option, extraParams)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "rounded-2xl px-3 py-2 text-caption font-semibold shadow-soft transition",
                selected
                  ? "bg-blue text-white"
                  : "border border-border bg-white text-ink-2 hover:border-blue/30 hover:bg-blue-soft",
              )}
            >
              {option}
              {suffix}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function buildHref(
  pathname: string,
  queryKey: string,
  value: number,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams(extraParams);
  params.set(queryKey, String(value));
  return `${pathname}?${params.toString()}`;
}
