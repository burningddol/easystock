import type { RevenueForecastAccuracyView } from "@/lib/application/inventory";

export function getRevenueMeanSignedWonError(
  accuracy: RevenueForecastAccuracyView | null | undefined,
): number | null {
  if (!accuracy || accuracy.evaluatedDayCount < 3) return null;
  if (accuracy.bias !== "over" && accuracy.bias !== "under") return null;

  const evaluated = accuracy.dailyResults.filter((day) => day.actualRevenue > 0);
  if (evaluated.length === 0) return null;
  return evaluated.reduce((sum, day) => sum + day.signedWonError, 0) / evaluated.length;
}

export function adjustRevenueForecast(revenue: number, meanSignedWonError: number | null): number {
  if (meanSignedWonError === null) return revenue;
  return Math.max(0, revenue - meanSignedWonError);
}
