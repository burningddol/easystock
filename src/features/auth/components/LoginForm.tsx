"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { type LoginInput, loginSchema } from "../schemas";

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const withdrawalNotice = searchParams.get("withdrawal_in_progress") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput): Promise<void> {
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    const next = searchParams.get("next") ?? "/today";
    router.push(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="glow-panel flex flex-col gap-stack rounded-[28px] border border-border bg-card p-5 shadow-card"
      noValidate
    >
      {withdrawalNotice && (
        <div
          role="alert"
          className="rounded-md bg-amber-soft p-stack text-body-regular text-amber-deep"
        >
          탈퇴 신청 진행 중인 계정입니다. 영구 삭제 전이면 이메일로 문의해주세요.
        </div>
      )}

      <Field label="이메일" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 shadow-soft"
        />
      </Field>

      <Field label="비밀번호" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          autoComplete="current-password"
          className="rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-1 shadow-soft"
        />
      </Field>

      {submitError && (
        <p role="alert" className="text-body-regular text-red">
          {submitError}
        </p>
      )}

      <PrimaryButton type="submit" disabled={isSubmitting}>
        {isSubmitting ? "로그인 중..." : "로그인"}
      </PrimaryButton>
    </form>
  );
}
