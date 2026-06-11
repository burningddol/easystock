import { cn } from "@/lib/utils";

/**
 * 페르소나 1차 액션 (저장 / 등록 / 불러오기) 버튼.
 * 디자인 토큰 ink-1 / bg, opacity 90% hover, disabled 50%.
 */

type PrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({
  className,
  children,
  ...rest
}: PrimaryButtonProps): React.ReactElement {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-xl bg-blue px-stack py-stack text-body font-semibold text-white shadow-soft transition hover:bg-blue-deep disabled:opacity-50 disabled:shadow-none",
        className,
      )}
    >
      {children}
    </button>
  );
}
