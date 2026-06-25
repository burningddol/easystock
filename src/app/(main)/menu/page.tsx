"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { MenuList } from "@/features/menu/components/MenuList";
import { TemplateLoadDialog } from "@/features/menu/components/TemplateLoadDialog";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { PageHeader } from "@/components/ui/page-header";

export default function MenuPage(): React.ReactElement {
  const { data, isLoading, error } = useMenus();

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="메뉴"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/menu/new"
              className="whitespace-nowrap rounded-2xl bg-blue px-4 py-3 text-body-regular font-semibold text-white shadow-card ring-1 ring-blue-deep/10 transition hover:-translate-y-0.5 hover:bg-blue-deep"
            >
              + 메뉴
            </Link>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-1 rounded-2xl border border-border-strong bg-white px-4 py-3 text-body-regular font-semibold text-ink-1 shadow-soft transition hover:-translate-y-0.5 hover:border-blue/30 hover:bg-blue-soft [&::-webkit-details-marker]:hidden">
                <span>작업</span>
                <ChevronDown
                  size={16}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-card">
                {MENU_ACTIONS.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="block rounded-xl px-3 py-2.5 text-caption font-semibold text-ink-1 transition hover:bg-blue-soft hover:text-blue-deep"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        }
      />

      {isLoading && <LoadingText />}
      {error && <ErrorAlert prefix="메뉴를 불러오지 못했어요:" message={error.message} />}

      {data && data.length === 0 && <TemplateLoadDialog />}

      {data && data.length > 0 && <MenuList menus={data} />}
    </section>
  );
}

const MENU_ACTIONS = [
  { href: "/inventory/forecast?tab=menu", label: "메뉴 예측" },
  { href: "/inventory/forecast-accuracy?tab=menu", label: "예측 정확도" },
] as const;
