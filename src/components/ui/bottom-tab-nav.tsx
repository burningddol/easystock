"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Calendar, House, Package, ScrollText, ShoppingBasket } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  Icon: typeof House;
  match: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  {
    label: "오늘",
    href: "/today",
    Icon: House,
    match: (p) => p === "/today",
  },
  {
    label: "캘린더",
    href: "/calendar",
    Icon: Calendar,
    match: (p) => p.startsWith("/calendar"),
  },
  {
    label: "판매",
    href: "/sale",
    Icon: ScrollText,
    match: (p) => p.startsWith("/sale"),
  },
  {
    label: "메뉴",
    href: "/menu",
    Icon: ShoppingBasket,
    match: (p) => p.startsWith("/menu"),
  },
  {
    label: "재료",
    href: "/inventory",
    Icon: Package,
    match: (p) => p.startsWith("/inventory"),
  },
];

export function BottomTabNav(): React.ReactElement {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(12);

  useEffect(() => {
    setMounted(true);

    function syncBottomOffset(): void {
      const visualViewport = window.visualViewport;
      if (!visualViewport) {
        setBottomOffset(12);
        return;
      }

      const hiddenViewportBottom = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop,
      );
      setBottomOffset(Math.round(hiddenViewportBottom + 12));
    }

    syncBottomOffset();
    window.visualViewport?.addEventListener("resize", syncBottomOffset);
    window.visualViewport?.addEventListener("scroll", syncBottomOffset);
    window.addEventListener("resize", syncBottomOffset);
    window.addEventListener("scroll", syncBottomOffset, { passive: true });

    return () => {
      window.visualViewport?.removeEventListener("resize", syncBottomOffset);
      window.visualViewport?.removeEventListener("scroll", syncBottomOffset);
      window.removeEventListener("resize", syncBottomOffset);
      window.removeEventListener("scroll", syncBottomOffset);
    };
  }, []);

  const nav = (
    <nav
      aria-label="주요 기능"
      className="fixed inset-x-0 z-[60] px-3"
      style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}
    >
      <ul className="mx-auto flex w-full max-w-screen-md items-stretch overflow-hidden rounded-[22px] border border-border bg-card/95 shadow-card backdrop-blur sm:rounded-[24px]">
        {TABS.map(({ label, href, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11px] font-medium transition sm:h-16 sm:gap-1 sm:rounded-[20px] sm:text-caption",
                  active ? "bg-blue-soft text-blue-deep" : "text-ink-2 hover:text-ink-1",
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden="true"
                  className="relative z-10"
                />
                <span className="relative z-10 truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (!mounted) return <></>;
  return createPortal(nav, document.body);
}
