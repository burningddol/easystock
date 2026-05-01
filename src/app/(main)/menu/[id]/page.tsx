"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { MenuDetailCard } from "@/features/menu/components/MenuDetailCard";
import { MenuActions } from "@/features/menu/components/MenuActions";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

export default function MenuDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useMenus();

  const menu = data?.find((m) => m.id === id);

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <Link href="/menu" className="text-body-regular text-ink-3 hover:text-ink-2">
          ← 메뉴 목록
        </Link>
      </header>

      {isLoading && <LoadingText />}
      {error && <ErrorAlert message={error.message} />}
      {data && !menu && <LoadingText>메뉴를 찾을 수 없습니다.</LoadingText>}

      {menu && (
        <>
          <MenuDetailCard menu={menu} />
          <MenuActions menuId={menu.id} menuName={menu.name} />
        </>
      )}
    </section>
  );
}
