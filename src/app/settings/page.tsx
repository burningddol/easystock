import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_TYPE_LABELS } from "@/features/auth/schemas";
import { LogoutButton } from "@/features/settings/components/LogoutButton";
import { PurchaseCoverageDaysEditor } from "@/features/settings/components/PurchaseCoverageDaysEditor";
import { RegularDaysOffEditor } from "@/features/settings/components/RegularDaysOffEditor";
import { SafetyBufferEditor } from "@/features/settings/components/SafetyBufferEditor";
import { StoreNameEditor } from "@/features/settings/components/StoreNameEditor";
import { VendorLeadTimeManager } from "@/features/settings/components/VendorLeadTimeManager";
import type { Weekday } from "@/lib/domain/regular-days-off";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";

type StoreType = keyof typeof STORE_TYPE_LABELS;

export default async function SettingsPage(): Promise<React.ReactElement> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings");
  }

  const { data } = await supabase
    .from("users")
    .select("store_name, store_type, regular_days_off, safety_buffer_days, purchase_coverage_days")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as {
    store_name: string;
    store_type: StoreType;
    regular_days_off: Weekday[];
    safety_buffer_days: number;
    purchase_coverage_days: number;
  } | null;
  const initialDaysOff: Weekday[] = profile?.regular_days_off ?? [];
  const safetyBufferDays = profile?.safety_buffer_days ?? 1;
  const purchaseCoverageDays = profile?.purchase_coverage_days ?? 7;
  const storeName = profile?.store_name ?? "내 가게";
  const storeType = profile?.store_type ?? "cafe";

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-md flex-col gap-section p-screen pb-24">
      <header className="rounded-[28px] border border-border bg-card px-5 py-5 shadow-card">
        <div className="flex items-start justify-between gap-stack">
          <div className="flex flex-col gap-1">
            <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">Settings</p>
            <h1 className="text-title-lg text-ink-1">가게 설정</h1>
            <p className="text-body-regular text-ink-3">
              운영 기준과 예측 계산 규칙을 한 번에 정리하는 곳입니다.
            </p>
          </div>
          <Link href="/today" className={SECONDARY_BUTTON_CLASSES}>
            닫기
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-stack rounded-[28px] border border-border bg-card p-5 shadow-card">
        <header className="flex flex-col gap-1">
          <h2 className="text-title-md text-ink-1">가게 정보</h2>
          <p className="text-caption text-ink-3">
            매장 이름과 가게 유형처럼 홈 화면과 리포트에 바로 보이는 정보입니다.
          </p>
        </header>

        <StoreNameEditor initialStoreName={storeName} userId={user.id} />
        <SettingRow label="가게 유형" value={STORE_TYPE_LABELS[storeType]} />
        <SettingRow label="로그인 이메일" value={user.email ?? "이메일 없음"} />

        <div className="flex flex-wrap gap-stack-tight pt-2">
          <button type="button" disabled className={`${SECONDARY_BUTTON_CLASSES} opacity-50`}>
            가게 유형 관리
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-stack rounded-[28px] border border-border bg-card p-5 shadow-card">
        <header className="flex flex-col gap-1">
          <h2 className="text-title-md text-ink-1">예측 · 운영 설정</h2>
          <p className="text-caption text-ink-3">
            소진 예측은 최근 소비 흐름을 바탕으로, 정기휴무·거래처 리드타임·안전여유일을 함께 반영해
            계산합니다.
          </p>
        </header>

        <div className="grid gap-stack-tight md:grid-cols-4">
          <RuleCard
            title="정기휴무"
            body="선택한 요일은 미래 시뮬레이션에서 소비 0으로 보고, 과거 평균 계산에서도 제외합니다."
          />
          <RuleCard
            title="거래처 리드타임"
            body="재료별 최근 구매 이력에서 가장 자주 연결된 거래처 리드타임을 씁니다. 구매 이력이 없으면 1일을 기본값으로 사용합니다."
          />
          <RuleCard
            title="안전여유일"
            body={`현재 ${safetyBufferDays}일로 설정되어 있습니다. 리드타임 뒤에 추가 버퍼를 더해 위험 단계를 더 보수적으로 잡습니다.`}
          />
          <RuleCard
            title="발주 커버일"
            body={`현재 ${purchaseCoverageDays}일로 설정되어 있습니다. 권장 발주량은 리드타임과 안전여유 뒤에 이 기간만큼 더 팔 수 있게 계산합니다.`}
          />
        </div>

        <RegularDaysOffEditor initialDaysOff={initialDaysOff} />

        <div className="grid gap-stack-tight border-t border-border pt-stack">
          <SafetyBufferEditor initialSafetyBufferDays={safetyBufferDays} userId={user.id} />
          <PurchaseCoverageDaysEditor
            initialPurchaseCoverageDays={purchaseCoverageDays}
            userId={user.id}
          />
          <SettingRow
            label="리드타임 기준"
            value={`각 재료는 구매 이력에서 가장 자주 연결된 거래처 리드타임을 따로 사용합니다. 거래처가 아직 없거나 구매 이력이 없으면 기본 1일로 계산합니다.`}
          />
          <SettingRow
            label="위험 단계 계산"
            value={`소진 예상일까지 남은 일수에서 거래처 리드타임과 안전여유 ${safetyBufferDays}일을 함께 빼서 safe / caution / order_needed / critical 단계를 정합니다.`}
          />
          <SettingRow
            label="권장 발주량 계산"
            value={`예상 수요 기준으로 리드타임과 안전여유를 버틴 뒤 ${purchaseCoverageDays}일치 운영분까지 채우도록 부족 수량을 추천합니다.`}
          />
          <VendorLeadTimeManager />
        </div>
      </section>

      <section className="flex flex-col gap-stack rounded-[28px] border border-border bg-card p-5 shadow-card">
        <header className="flex flex-col gap-1">
          <h2 className="text-title-md text-ink-1">계정</h2>
          <p className="text-caption text-ink-3">
            로그인 상태와 알림, 계정 접근을 관리하는 영역입니다.
          </p>
        </header>

        <SettingRow
          label="로그아웃"
          value="현재 기기 세션을 종료하고 로그인 화면으로 돌아갑니다."
        />
        <LogoutButton />
        <SettingRow
          label="푸시 알림"
          value="주문 알림과 마감 리마인더를 받을 기기 설정을 여기에 붙일 예정입니다."
        />
      </section>

      <section className="flex flex-col gap-stack rounded-[28px] border border-red bg-red-soft p-5 shadow-soft">
        <header className="flex flex-col gap-1">
          <h2 className="text-title-md text-red-deep">위험영역</h2>
          <p className="text-caption text-red-deep">
            되돌리기 어려운 작업은 별도 확인 단계를 붙여서 배치할 예정입니다.
          </p>
        </header>

        <SettingRow
          label="탈퇴 신청"
          value="탈퇴를 신청하면 30일 후 영구 삭제됩니다. 다음 단계에서 안내와 확인 모달을 연결합니다."
          tone="danger"
        />
      </section>
    </main>
  );
}

function SettingRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-bg px-stack py-stack">
      <p className={tone === "danger" ? "text-label text-red-deep" : "text-label text-ink-2"}>
        {label}
      </p>
      <p
        className={
          tone === "danger" ? "text-body-regular text-red-deep" : "text-body-regular text-ink-1"
        }
      >
        {value}
      </p>
    </div>
  );
}

function RuleCard({ title, body }: { title: string; body: string }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-bg px-stack py-stack shadow-soft">
      <p className="text-label text-blue-deep">{title}</p>
      <p className="mt-1 text-caption text-ink-3">{body}</p>
    </div>
  );
}
