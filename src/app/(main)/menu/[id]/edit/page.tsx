"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MenuForm } from "@/features/menu/components/MenuForm";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { useActiveIngredients } from "@/features/menu/hooks/useActiveIngredients";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import type { MenuInput } from "@/features/menu/schemas";

export default function MenuEditPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { data: menus, isLoading: menusLoading, error: menusError } = useMenus();
  const {
    data: ingredients,
    isLoading: ingredientsLoading,
    error: ingredientsError,
  } = useActiveIngredients();

  const menu = menus?.find((m) => m.id === id);
  const isLoading = menusLoading || ingredientsLoading;

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="메뉴 수정"
        action={
          <Link href={`/menu/${id}`} className="text-body-regular text-ink-3 hover:text-ink-2">
            취소
          </Link>
        }
      />

      {isLoading && <LoadingText />}
      {ingredientsError && (
        <ErrorAlert prefix="재료 목록을 불러오지 못했어요:" message={ingredientsError.message} />
      )}
      {menusError && <ErrorAlert message={menusError.message} />}

      {!isLoading && !ingredientsError && menus && !menu && (
        <p className="text-body-regular text-ink-3">메뉴를 찾을 수 없습니다.</p>
      )}

      {menu && !ingredientsError && (
        <MenuForm
          ingredients={ingredients ?? []}
          mode={{
            kind: "edit",
            menuId: menu.id,
            initialValues: toInitialValues(menu),
          }}
        />
      )}
    </section>
  );
}

function toInitialValues(
  menu: NonNullable<ReturnType<typeof useMenus>["data"]>[number],
): MenuInput {
  return {
    name: menu.name,
    price: menu.price,
    recipe: menu.recipe_items.map((item) => ({
      ingredientId: item.ingredient.id,
      quantityPerServing: item.quantity_per_serving,
    })),
  };
}
