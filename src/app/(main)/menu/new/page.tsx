"use client";

import Link from "next/link";
import { MenuForm } from "@/features/menu/components/MenuForm";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { useActiveIngredients } from "@/features/menu/hooks/useActiveIngredients";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

export default function MenuNewPage(): React.ReactElement {
  const { data: menus, isLoading: menusLoading } = useMenus();
  const { data: ingredients, isLoading: ingredientsLoading, error } = useActiveIngredients();

  const isLoading = menusLoading || ingredientsLoading;
  const isFirstMenu = (menus?.length ?? 0) === 0;

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="메뉴 추가"
        action={
          <Link href="/menu" className="text-body-regular text-ink-3 hover:text-ink-2">
            취소
          </Link>
        }
      />

      {isLoading && <LoadingText />}
      {error && <ErrorAlert prefix="재료 목록을 불러오지 못했어요:" message={error.message} />}

      {!isLoading && !error && (
        <MenuForm ingredients={ingredients ?? []} mode={{ kind: "create", isFirstMenu }} />
      )}
    </section>
  );
}
