import type { CalendarCell, CalendarMonthData } from "@/lib/supabase/rpc";
import { getCalendarMonth } from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface EnrichedCalendarCell extends CalendarCell {
  consecutiveMissingDays: number;
}

export interface CalendarMonthView extends Omit<CalendarMonthData, "cells"> {
  cells: EnrichedCalendarCell[];
}

export function withConsecutiveMissingDays(cells: readonly CalendarCell[]): EnrichedCalendarCell[] {
  let counter = 0;
  return cells.map((cell) => {
    counter = cell.isMissing ? counter + 1 : 0;
    return { ...cell, consecutiveMissingDays: counter };
  });
}

export async function loadCalendarMonth(
  client: RpcClient,
  year: number,
  month: number,
): Promise<CalendarMonthView> {
  const { data, error } = await getCalendarMonth(client, { year, month });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("calendar data missing");
  return { ...data, cells: withConsecutiveMissingDays(data.cells) };
}
