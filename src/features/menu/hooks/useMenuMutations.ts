"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MenuInput } from "../schemas";
import { createMenu, removeMenu, updateMenu, type EditMenuInput } from "@/lib/application/menu";
import { invalidateMenuCaches } from "./useMenus";

interface EditMenuVariables {
  menuId: string;
  values: MenuInput;
}

export function useCreateMenu(): UseMutationResult<string, Error, MenuInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values) => {
      const supabase = createClient();
      return createMenu(supabase, values);
    },
    onSuccess: () => invalidateMenuCaches(queryClient),
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
        optionGroups: values.optionGroups,
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
