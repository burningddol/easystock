// 라우트 페이지의 fetch loading/error 표시 — 9곳에서 inline JSX 중복이라 단일 atom.

export function LoadingText({
  children = "불러오는 중…",
}: {
  children?: string;
}): React.ReactElement {
  return <p className="text-body-regular text-ink-3">{children}</p>;
}

interface ErrorAlertProps {
  message: string;
  prefix?: string;
}

export function ErrorAlert({ message, prefix }: ErrorAlertProps): React.ReactElement {
  return (
    <p role="alert" className="text-body-regular text-red-deep">
      {prefix ? `${prefix} ${message}` : message}
    </p>
  );
}
