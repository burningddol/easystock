import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 판매 입력 폼 임시저장 (Zustand).
 *
 * 페르소나 마감 후 5분 입력 흐름 보호 — 입력 중 페이지 이탈/실수로
 * 작성한 내용 사라지지 않도록 localStorage에 자동 저장.
 *
 * 실제 sale row는 PR 14 (Phase 4 US1 sale)에서 saveSale RPC로 저장.
 */

export interface SaleDraftItem {
  menuId: string;
  quantity: number;
}

interface SaleDraftState {
  draftDate: string | null; // YYYY-MM-DD, 입력 대상 날짜
  items: SaleDraftItem[];
  setDraftDate: (date: string | null) => void;
  setQuantity: (menuId: string, quantity: number) => void;
  removeItem: (menuId: string) => void;
  clear: () => void;
}

export const useSaleDraft = create<SaleDraftState>()(
  persist(
    (set) => ({
      draftDate: null,
      items: [],

      setDraftDate: (date) => set({ draftDate: date }),

      setQuantity: (menuId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((it) => it.menuId !== menuId) };
          }
          const existing = state.items.find((it) => it.menuId === menuId);
          if (existing) {
            return {
              items: state.items.map((it) => (it.menuId === menuId ? { ...it, quantity } : it)),
            };
          }
          return { items: [...state.items, { menuId, quantity }] };
        }),

      removeItem: (menuId) =>
        set((state) => ({ items: state.items.filter((it) => it.menuId !== menuId) })),

      clear: () => set({ draftDate: null, items: [] }),
    }),
    {
      name: "easystock-sale-draft",
      version: 1,
    },
  ),
);
