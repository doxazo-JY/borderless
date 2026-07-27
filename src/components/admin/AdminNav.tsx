"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ base }: { base: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `${base}/setup`, label: "설정" },
    { href: `${base}/team`, label: "팀" },
  ];

  return (
    <nav className="sticky top-0 z-30 flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
      {tabs.map((tab) => {
        const isActive = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? "rounded bg-zinc-900 px-3 py-1.5 font-semibold text-white"
                : "rounded px-3 py-1.5 text-zinc-500 underline underline-offset-2 hover:bg-zinc-200"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
