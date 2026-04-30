/**
 * 가입 후 7일 이내 사용자에게 표시. FR-018: 콜드스타트 동안 예측 가동 안 함.
 */
export function ColdStartNotice(): React.ReactElement {
  return (
    <div
      role="status"
      className="rounded-lg border border-border bg-amber-soft p-tile text-body-regular text-amber-deep"
    >
      <p className="font-semibold">데이터 수집 중입니다 (가입 후 7일)</p>
      <p className="mt-1 text-caption">
        매일 판매를 입력하시면 7일 후부터 재료별 소진일과 발주 시점을 예측해드려요.
      </p>
    </div>
  );
}
