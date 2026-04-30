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
    <nav
      aria-label="주요 기능"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card"
    >
      <ul className="mx-auto flex max-w-screen-md items-stretch">
        {TABS.map(({ label, href, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-caption",
                  active ? "text-ink-1" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.6} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
