"use client";

interface SaleErrorNoticeProps {
  title: string;
  message: string;
}

export function SaleErrorNotice({ title, message }: SaleErrorNoticeProps): React.ReactElement {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-[24px] border border-rose-200 bg-rose-50/90 px-4 py-3 shadow-soft"
    >
      <p className="text-caption font-semibold text-rose-800">{title}</p>
      <p className="mt-1 text-caption text-rose-700 whitespace-pre-line">{message}</p>
    </div>
  );
}
