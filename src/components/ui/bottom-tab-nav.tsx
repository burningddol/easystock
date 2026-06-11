"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav aria-label="주요 기능" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
      <ul className="mx-auto flex max-w-screen-md items-stretch rounded-[24px] border border-border bg-card/95 shadow-card backdrop-blur">
        {TABS.map(({ label, href, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 rounded-[20px] text-caption transition",
                  active ? "bg-blue-soft text-blue-deep" : "text-ink-2 hover:text-ink-1",
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden="true"
                  className="relative z-10"
                />
                <span className="relative z-10">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
