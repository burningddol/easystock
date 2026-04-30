import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register(): void {
  if (!DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === "production",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV === "production",
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
