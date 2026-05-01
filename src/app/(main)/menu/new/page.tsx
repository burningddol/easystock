"use client";

import Link from "next/link";
import { MenuForm } from "@/features/menu/components/MenuForm";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { useActiveIngredients } from "@/features/menu/hooks/useActiveIngredients";

export default function MenuNewPage(): React.ReactElement {
  const { data: menus, isLoading: menusLoading } = useMenus();
  const { data: ingredients, isLoading: ingredientsLoading, error } = useActiveIngredients();

  const isLoading = menusLoading || ingredientsLoading;
  const isFirstMenu = (menus?.length ?? 0) === 0;

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">메뉴 추가</h1>
        <Link href="/menu" className="text-body-regular text-ink-3 hover:text-ink-2">
          취소
        </Link>
      </header>

      {isLoading && <p className="text-body-regular text-ink-3">불러오는 중…</p>}

      {error && (
        <p role="alert" className="text-body-regular text-red">
          재료 목록을 불러오지 못했어요: {error.message}
        </p>
      )}

      {!isLoading && !error && (
        <MenuForm ingredients={ingredients ?? []} mode={{ kind: "create", isFirstMenu }} />
      )}
    </section>
  );
}
