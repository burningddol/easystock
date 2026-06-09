"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton(): React.ReactElement {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    setIsSubmitting(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-stack-tight">
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={isSubmitting}
        className={`${SECONDARY_BUTTON_CLASSES} w-fit disabled:opacity-50`}
      >
        {isSubmitting ? "로그아웃 중..." : "로그아웃"}
      </button>
      {errorMessage && (
        <p role="alert" className="text-caption text-red">
          로그아웃 실패: {errorMessage}
        </p>
      )}
    </div>
  );
}
