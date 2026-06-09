import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_TYPE_LABELS } from "@/features/auth/schemas";
import { LogoutButton } from "@/features/settings/components/LogoutButton";
import { RegularDaysOffEditor } from "@/features/settings/components/RegularDaysOffEditor";
import { StoreNameEditor } from "@/features/settings/components/StoreNameEditor";
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
    .select("store_name, store_type, regular_days_off")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as {
    store_name: string;
    store_type: StoreType;
    regular_days_off: Weekday[];
  } | null;
  const initialDaysOff: Weekday[] = profile?.regular_days_off ?? [];
  const storeName = profile?.store_name ?? "내 가게";
  const storeType = profile?.store_type ?? "cafe";

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-md flex-col gap-section p-screen pb-20">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-micro text-ink-3">설정</p>
          <h1 className="text-title-lg text-ink-1">가게 설정</h1>
        </div>
        <Link href="/today" className="text-body-regular text-ink-3 hover:text-ink-2">
          닫기
        </Link>
      </header>

      <section className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
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

      <section className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
        <header className="flex flex-col gap-1">
          <h2 className="text-title-md text-ink-1">예측 · 운영 설정</h2>
          <p className="text-caption text-ink-3">
            소진 예측과 운영 알림에 직접 영향을 주는 값입니다.
          </p>
        </header>

        <RegularDaysOffEditor initialDaysOff={initialDaysOff} />

        <div className="grid gap-stack-tight border-t border-border pt-stack">
          <SettingRow
            label="거래처 리드타임"
            value="각 재료 예측은 가장 자주 쓰는 거래처 리드타임을 사용합니다."
          />
          <div className="flex flex-wrap gap-stack-tight">
            <Link href="/purchase" className={SECONDARY_BUTTON_CLASSES}>
              거래처 관리로 이동
            </Link>
            <button type="button" disabled className={`${SECONDARY_BUTTON_CLASSES} opacity-50`}>
              안전여유일 설정
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
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

      <section className="flex flex-col gap-stack rounded-lg border border-red-soft bg-red-soft p-tile">
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
    <div className="flex flex-col gap-1 rounded-md bg-bg px-stack py-stack-tight">
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
