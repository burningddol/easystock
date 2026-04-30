"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trackEvent } from "@/lib/analytics/ga4";
import { createClient } from "@/lib/supabase/client";
import {
  STORE_TYPES,
  STORE_TYPE_LABELS,
  type SignupInput,
  signupSchema,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from "../schemas";

const DEFAULT_VALUES: SignupInput = {
  email: "",
  password: "",
  storeName: "",
  storeType: "bingsu_cafe",
  regularDaysOff: [],
};

export function SignupForm(): React.ReactElement {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: SignupInput): Promise<void> {
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          store_name: values.storeName,
          store_type: values.storeType,
          regular_days_off: values.regularDaysOff,
        },
      },
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    trackEvent("signup_complete", { store_type: values.storeType });
    router.push("/today");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-stack"
      noValidate
    >
      <Field label="이메일" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="비밀번호 (8자 이상)" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          autoComplete="new-password"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="가게 이름" error={errors.storeName?.message}>
        <input
          {...register("storeName")}
          type="text"
          autoComplete="organization"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
        />
      </Field>

      <Field label="가게 유형" error={errors.storeType?.message}>
        <div className="flex gap-stack-tight">
          {STORE_TYPES.map((type) => (
            <label
              key={type}
              className="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-2 has-[:checked]:border-ink-1 has-[:checked]:bg-card-hover"
            >
              <input {...register("storeType")} type="radio" value={type} className="sr-only" />
              {STORE_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </Field>

      <Field label="정기휴무 (선택)" error={errors.regularDaysOff?.message}>
        <div className="flex gap-stack-tight">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-body-regular text-ink-2 has-[:checked]:border-ink-1 has-[:checked]:bg-ink-1 has-[:checked]:text-bg"
            >
              <input
                {...register("regularDaysOff")}
                type="checkbox"
                value={day}
                className="sr-only"
              />
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </div>
      </Field>

      {submitError && (
        <p role="alert" className="text-body-regular text-red">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-ink-1 px-stack py-stack text-body text-bg hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "가입 중..." : "가입하기"}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps): React.ReactElement {
  return (
    <label className="flex flex-col gap-stack-tight">
      <span className="text-label text-ink-2">{label}</span>
      {children}
      {error && <span className="text-caption text-red">{error}</span>}
    </label>
  );
}
