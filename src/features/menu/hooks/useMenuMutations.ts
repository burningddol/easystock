"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteMenu, editMenu } from "@/lib/supabase/rpc";
import type { MenuInput } from "../schemas";
import { menuListQueryKey } from "./useMenus";

interface EditMenuVariables {
  menuId: string;
  values: MenuInput;
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
    },
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
    },
  });
}
