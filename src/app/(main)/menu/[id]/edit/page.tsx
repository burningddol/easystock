"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MenuForm } from "@/features/menu/components/MenuForm";
import { useMenus } from "@/features/menu/hooks/useMenus";
import type { MenuInput } from "@/features/menu/schemas";

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

export default function MenuEditPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { data: menus, isLoading: menusLoading, error: menusError } = useMenus();
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(true);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (error) setIngredientsError(error.message);
        else setIngredients(data ?? []);
        setIngredientsLoading(false);
      });
  }, []);

  const menu = menus?.find((m) => m.id === id);
  const isLoading = menusLoading || ingredientsLoading;

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">메뉴 수정</h1>
        <Link href={`/menu/${id}`} className="text-body-regular text-ink-3 hover:text-ink-2">
          취소
        </Link>
      </header>

      {isLoading && <p className="text-body-regular text-ink-3">불러오는 중…</p>}

      {ingredientsError && (
        <p role="alert" className="text-body-regular text-red">
          재료 목록을 불러오지 못했어요: {ingredientsError}
        </p>
      )}

      {menusError && (
        <p role="alert" className="text-body-regular text-red">
          {menusError.message}
        </p>
      )}

      {!isLoading && !ingredientsError && menus && !menu && (
        <p className="text-body-regular text-ink-3">메뉴를 찾을 수 없습니다.</p>
      )}

      {menu && !ingredientsError && (
        <MenuForm
          ingredients={ingredients}
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
