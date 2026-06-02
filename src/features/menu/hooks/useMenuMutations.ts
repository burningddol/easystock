"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MenuInput } from "../schemas";
import { createMenu, removeMenu, updateMenu, type EditMenuInput } from "@/lib/application/menu";
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
      return createMenu(supabase, values);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuListQueryKey }),
  });
}

export function useEditMenu(): UseMutationResult<string, Error, EditMenuVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ menuId, values }) => {
      const supabase = createClient();
      const payload: EditMenuInput = {
        menuId,
        name: values.name,
        price: values.price,
        recipe: values.recipe,
      };
      return updateMenu(supabase, payload);
    },
    onSuccess: () => invalidateMenuCaches(queryClient),
  });
}

export function useDeleteMenu(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menuId) => {
      const supabase = createClient();
      return removeMenu(supabase, menuId);
    },
    onSuccess: () => invalidateMenuCaches(queryClient),
  });
}
