"use client";

import Link from "next/link";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { MenuList } from "@/features/menu/components/MenuList";
import { TemplateLoadDialog } from "@/features/menu/components/TemplateLoadDialog";

export default function MenuPage(): React.ReactElement {
  const { data, isLoading, error } = useMenus();

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">메뉴</h1>
        <Link
          href="/menu/new"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-2 hover:bg-card-hover"
        >
          + 추가
        </Link>
      </header>

      {isLoading && <p className="text-body-regular text-ink-3">불러오는 중…</p>}

      {error && (
        <p role="alert" className="text-body-regular text-red">
          메뉴를 불러오지 못했어요: {error.message}
        </p>
      )}

      {data && data.length === 0 && <TemplateLoadDialog />}

      {data && data.length > 0 && <MenuList menus={data} />}
    </section>
  );
}
