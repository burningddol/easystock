interface PageHeaderProps {
  title: string;
  /** 우측 액션 영역 — Link / button / Chip 등 ReactNode 그대로 넘김. */
  action?: React.ReactNode;
}

/**
 * 페이지 상단 헤더 — `<h1 text-title-lg>` + 우측 액션 슬롯.
 * 6개 페이지에서 동일 markup이 반복되어 단일 출처로.
 */
export function PageHeader({ title, action }: PageHeaderProps): React.ReactElement {
  return (
    <header className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
      <div className="flex items-center justify-between gap-stack-tight">
        <div className="flex flex-col gap-1">
          <span className="text-micro uppercase tracking-[0.14em] text-blue-deep">Workspace</span>
          <h1 className="text-title-lg text-ink-1">{title}</h1>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </header>
  );
}
