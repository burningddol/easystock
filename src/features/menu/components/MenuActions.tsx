"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeleteMenu } from "../hooks/useMenuMutations";

interface MenuActionsProps {
  menuId: string;
  menuName: string;
}

/**
 * 메뉴 상세 페이지의 수정/삭제 액션. 삭제는 soft delete + confirm.
 * sale_items 참조는 보존 (헌법 III 스냅샷) — 통계에는 남고 목록에서만 사라짐.
 */
export function MenuActions({ menuId, menuName }: MenuActionsProps): React.ReactElement {
  const router = useRouter();
  const deleteMutation = useDeleteMenu();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(): Promise<void> {
    const confirmed = window.confirm(
      `"${menuName}" 메뉴를 삭제할까요?\n\n과거 판매 기록은 그대로 보존되고 메뉴 목록에서만 사라져요.`,
    );
    if (!confirmed) return;

    setError(null);
    try {
      await deleteMutation.mutateAsync(menuId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
      return;
    }
    router.push("/menu");
  }

  return (
    <div className="flex flex-col gap-stack-tight">
      <div className="flex gap-stack-tight">
        <Link
          href={`/menu/${menuId}/edit`}
          className="flex-1 rounded-md border border-border bg-card py-stack-tight text-center text-body-regular text-ink-1 hover:bg-card-hover"
        >
          수정
        </Link>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleteMutation.isPending}
          className="flex-1 rounded-md border border-red bg-card py-stack-tight text-body-regular text-red-deep hover:bg-red-soft disabled:opacity-60"
        >
          {deleteMutation.isPending ? "삭제 중…" : "삭제"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-caption text-red">
          {error}
        </p>
      )}
    </div>
  );
}
