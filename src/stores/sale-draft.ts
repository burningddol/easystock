import { create } from "zustand";
import { persist } from "zustand/middleware";

// 판매 입력 폼 임시저장 — 날짜별로 분리해서 과거/오늘 드래프트가 섞이지 않도록 함.

export interface SaleDraftItem {
  menuId: string;
  quantity: number;
  options: SaleDraftOptionItem[];
}

export interface SaleDraftOptionItem {
  groupId: string;
  optionValueId: string;
  quantity: number;
}

export type SaleDraftsByDate = Record<string, SaleDraftItem[]>;
export const EMPTY_SALE_DRAFT_ITEMS: SaleDraftItem[] = [];

export function sanitizeSaleDraftItems(
  items: readonly SaleDraftItem[],
  validMenuIds: ReadonlySet<string>,
): SaleDraftItem[] {
  return items.filter((item) => validMenuIds.has(item.menuId));
}

export function upsertSaleDraftItems(
  draftsByDate: SaleDraftsByDate,
  date: string,
  menuId: string,
  quantity: number,
): SaleDraftsByDate {
  const current = draftsByDate[date] ?? [];
  let nextItems: SaleDraftItem[];

  if (quantity <= 0) {
    nextItems = current.filter((item) => item.menuId !== menuId);
  } else {
    const existing = current.find((item) => item.menuId === menuId);
    nextItems = existing
      ? current.map((item) => (item.menuId === menuId ? { ...item, quantity } : item))
      : [...current, { menuId, quantity, options: [] }];
  }

  return {
    ...draftsByDate,
    [date]: nextItems,
  };
}

export function clearSaleDraftDate(draftsByDate: SaleDraftsByDate, date: string): SaleDraftsByDate {
  if (!(date in draftsByDate)) return draftsByDate;
  const next = { ...draftsByDate };
  delete next[date];
  return next;
}

export function replaceSaleDraftDateItems(
  draftsByDate: SaleDraftsByDate,
  date: string,
  items: readonly SaleDraftItem[],
): SaleDraftsByDate {
  return {
    ...draftsByDate,
    [date]: [...items],
  };
}

export function setSaleDraftOptionQuantity(
  draftsByDate: SaleDraftsByDate,
  date: string,
  menuId: string,
  groupId: string,
  optionValueId: string,
  quantity: number,
): SaleDraftsByDate {
  const current = draftsByDate[date] ?? [];
  const nextItems = current.map((item) => {
    if (item.menuId !== menuId) return item;
    const options = item.options ?? [];
    const nextOptions = options.filter(
      (opt) => opt.groupId !== groupId || opt.optionValueId !== optionValueId,
    );
    if (quantity > 0) {
      nextOptions.push({ groupId, optionValueId, quantity });
    }
    return { ...item, options: nextOptions };
  });

  return {
    ...draftsByDate,
    [date]: nextItems,
  };
}

interface SaleDraftState {
  draftsByDate: SaleDraftsByDate;
  setQuantity: (date: string, menuId: string, quantity: number) => void;
  setOptionQuantity: (
    date: string,
    menuId: string,
    groupId: string,
    optionValueId: string,
    quantity: number,
  ) => void;
  clearDate: (date: string) => void;
  replaceDateItems: (date: string, items: readonly SaleDraftItem[]) => void;
}

interface LegacySaleDraftState {
  draftDate?: string | null;
  items?: SaleDraftItem[];
}

export const useSaleDraft = create<SaleDraftState>()(
  persist(
    (set) => ({
      draftsByDate: {},

      setQuantity: (date, menuId, quantity) =>
        set((state) => ({
          draftsByDate: upsertSaleDraftItems(state.draftsByDate, date, menuId, quantity),
        })),

      setOptionQuantity: (date, menuId, groupId, optionValueId, quantity) =>
        set((state) => ({
          draftsByDate: setSaleDraftOptionQuantity(
            state.draftsByDate,
            date,
            menuId,
            groupId,
            optionValueId,
            quantity,
          ),
        })),

      clearDate: (date) =>
        set((state) => ({
          draftsByDate: clearSaleDraftDate(state.draftsByDate, date),
        })),

      replaceDateItems: (date, items) =>
        set((state) => ({
          draftsByDate: replaceSaleDraftDateItems(state.draftsByDate, date, items),
        })),
    }),
    {
      name: "easystock-sale-draft",
      version: 2,
      migrate: (persistedState) => {
        const legacy = persistedState as LegacySaleDraftState & Partial<SaleDraftState>;
        if (legacy?.draftsByDate) return persistedState as SaleDraftState;

        const date = legacy?.draftDate ?? null;
        const items = legacy?.items ?? [];
        return {
          draftsByDate: date ? { [date]: items } : {},
        };
      },
      partialize: (state) => ({ draftsByDate: state.draftsByDate }),
    },
  ),
);
