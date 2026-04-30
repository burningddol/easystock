/**
 * 판매 입력/편집 화면 하단 고정 액션 바.
 * BottomTabNav(64px) 바로 위에 띄움 (bottom-16 = 64px).
 *
 * 입력 폼: primary 1개 (저장)
 * 편집 다이얼로그: secondary 1개 (삭제) + primary 1개 (수정 저장)
 */

interface SaleSaveBarProps {
  left?: React.ReactNode;
  right: React.ReactNode;
}

export function SaleSaveBar({ left, right }: SaleSaveBarProps): React.ReactElement {
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-bg px-screen py-stack">
      <div className="mx-auto flex max-w-screen-md items-center gap-stack">
        {left}
        <div className="ml-auto">{right}</div>
      </div>
    </div>
  );
}
