"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteMenu, editMenu, saveMenu } from "@/lib/supabase/rpc";
import type { MenuInput } from "../schemas";
import { invalidateMenuCaches, menuListQueryKey } from "./useMenus";

interface EditMenuVariables {
  menuId: string;
  values: MenuInput;
}

// 신규 메뉴는 sale·consumption이 없으므로 forecast 캐시는 그대로 — menuList만 invalidate.
// 편집/삭제는 recipe 구성이 바뀌어 forecast 영향 → invalidateMenuCaches로 함께 처리.
export function useCreateMenu(): UseMutationResult<string, Error, MenuInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values) => {
      const supabase = createClient();
      const { data, error } = await saveMenu(supabase, values);
      if (error) throw new Error(error.message);
      const row = data?.[0];
      if (!row) throw new Error("save_menu returned empty");
      return row.menu_id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuListQueryKey }),
  });
}

export function useEditMenu(): UseMutationResult<string, Error, EditMenuVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ menuId, values }) => {
      const supabase = createClient();
      const { data, error } = await editMenu(supabase, {
        menuId,
        name: values.name,
        price: values.price,
        recipe: values.recipe,
      });
      if (error) throw new Error(error.message);
      const row = data?.[0];
      if (!row) throw new Error("edit_menu returned empty");
      return row.menu_id;
    },
    onSuccess: () => invalidateMenuCaches(queryClient),
  });
}

export function useDeleteMenu(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menuId) => {
      const supabase = createClient();
      const { error } = await deleteMenu(supabase, menuId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateMenuCaches(queryClient),
  });
}
