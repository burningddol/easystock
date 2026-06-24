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
  const [frame, setFrame] = useState({ left: 12, width: 351 });

  useEffect(() => {
    setMounted(true);

    function syncFrame(): void {
      const visualViewport = window.visualViewport;
      const documentWidth = document.documentElement.clientWidth;
      const maxWidth = 768;
      const horizontalGap = documentWidth < 640 ? 12 : 0;
      const navWidth = Math.min(maxWidth, Math.max(0, documentWidth - horizontalGap * 2));
      const left = Math.max(horizontalGap, Math.round((documentWidth - navWidth) / 2));
      const hiddenViewportBottom = visualViewport
        ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
        : 0;

      setFrame({ left, width: navWidth });
      setBottomOffset(Math.round(hiddenViewportBottom + 12));
    }

    syncFrame();
    window.visualViewport?.addEventListener("resize", syncFrame);
    window.visualViewport?.addEventListener("scroll", syncFrame);
    window.addEventListener("resize", syncFrame);
    window.addEventListener("scroll", syncFrame, { passive: true });

    return () => {
      window.visualViewport?.removeEventListener("resize", syncFrame);
      window.visualViewport?.removeEventListener("scroll", syncFrame);
      window.removeEventListener("resize", syncFrame);
      window.removeEventListener("scroll", syncFrame);
    };
  }, []);

  const nav = (
    <nav
      aria-label="주요 기능"
      className="fixed z-[60]"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
        left: frame.left,
        width: frame.width,
      }}
    >
      <ul className="flex w-full items-stretch overflow-hidden rounded-[22px] border border-border bg-card/95 shadow-card backdrop-blur sm:rounded-[24px]">
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
