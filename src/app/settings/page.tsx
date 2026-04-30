import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RegularDaysOffEditor } from "@/features/settings/components/RegularDaysOffEditor";
import type { Weekday } from "@/lib/domain/regular-days-off";

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
    .select("regular_days_off")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as { regular_days_off: Weekday[] } | null;
  const initialDaysOff: Weekday[] = profile?.regular_days_off ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-md flex-col gap-section p-screen pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">가게 설정</h1>
        <Link href="/today" className="text-body-regular text-ink-3 hover:text-ink-2">
          닫기
        </Link>
      </header>

      <RegularDaysOffEditor initialDaysOff={initialDaysOff} />
    </main>
  );
}
