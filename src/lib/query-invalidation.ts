"use client";

import type { QueryClient } from "@tanstack/react-query";

function invalidate(queryClient: QueryClient, queryKey: readonly unknown[]): void {
  void queryClient.invalidateQueries({ queryKey });
}

export function invalidateForecastQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["inventory", "forecast"]);
  invalidate(queryClient, ["inventory", "menu-demand-forecast"]);
  invalidate(queryClient, ["inventory", "order-report"]);
  invalidate(queryClient, ["inventory", "menu-forecast-accuracy"]);
  invalidate(queryClient, ["inventory", "ingredient-forecast-accuracy"]);
  invalidate(queryClient, ["inventory", "revenue-forecast-accuracy"]);
}

export function invalidateSaleWriteRelatedQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["sales"]);
  invalidate(queryClient, ["calendar"]);
  invalidate(queryClient, ["dashboard"]);
  invalidate(queryClient, ["menus"]);
  invalidate(queryClient, ["ingredients"]);
  invalidateForecastQueries(queryClient);
}

export function invalidatePurchaseWriteRelatedQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["purchases"]);
  invalidate(queryClient, ["calendar"]);
  invalidate(queryClient, ["dashboard"]);
  invalidate(queryClient, ["menus"]);
  invalidate(queryClient, ["ingredients"]);
  invalidateForecastQueries(queryClient);
}

export function invalidateMenuWriteRelatedQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["dashboard"]);
  invalidate(queryClient, ["calendar"]);
  invalidate(queryClient, ["menus"]);
  invalidateForecastQueries(queryClient);
}

export function invalidateIngredientWriteRelatedQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["dashboard"]);
  invalidate(queryClient, ["menus"]);
  invalidate(queryClient, ["ingredients"]);
  invalidateForecastQueries(queryClient);
}

export function invalidateSettingsWriteRelatedQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["dashboard"]);
  invalidate(queryClient, ["calendar"]);
  invalidateForecastQueries(queryClient);
}

export function invalidateVendorWriteRelatedQueries(queryClient: QueryClient): void {
  invalidate(queryClient, ["vendors"]);
  invalidateForecastQueries(queryClient);
}
