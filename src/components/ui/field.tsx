/**
 * 폼 필드 wrapper — 라벨 / 입력 / 에러 메시지 정렬.
 * auth / menu / 후속 도메인 폼에서 공유.
 */

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, error, children }: FieldProps): React.ReactElement {
  return (
    <label className="flex flex-col gap-stack-tight">
      <span className="text-label text-ink-2">{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-caption text-red">
          {error}
        </span>
      )}
    </label>
  );
}
