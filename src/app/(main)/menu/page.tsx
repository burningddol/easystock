"use client";

import Link from "next/link";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { MenuList } from "@/features/menu/components/MenuList";
import { TemplateLoadDialog } from "@/features/menu/components/TemplateLoadDialog";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";

export default function MenuPage(): React.ReactElement {
  const { data, isLoading, error } = useMenus();

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="메뉴"
        action={
          <div className="flex gap-stack-tight">
            <Link href="/menu/menu-forecast" className={SECONDARY_BUTTON_CLASSES}>
              메뉴 예측
            </Link>
            <Link href="/menu/new" className={SECONDARY_BUTTON_CLASSES}>
              + 추가
            </Link>
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
