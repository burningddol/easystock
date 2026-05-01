interface MetricProps {
  label: string;
  value: string;
}

/**
 * KPI 카드 단위 메트릭 — label + value 2줄.
 * YesterdayKpi / MonthCumulative / CellDetail 패널에서 4-grid 셀 단위로 사용.
 *
 * StickyTotalCard의 Metric은 accent variant + "원" suffix로 변형이 커서 자체 보유.
 */
export function Metric({ label, value }: MetricProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro text-ink-3">{label}</span>
      <span className="text-metric-md tabular-nums text-ink-1">{value}</span>
    </div>
  );
}
