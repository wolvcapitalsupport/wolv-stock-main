"use client";
import { useState } from "react";
import Link from "next/link";
import { PRIMARY_TABS, MORE_TABS } from "@/lib/rwaData";

const chip = (active: boolean) =>
  `whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b90b] ${
    active
      ? "bg-[#f0b90b] text-black border-[#f0b90b]"
      : "bg-[#0e0e1c] text-[#94a3b8] border-[#1b1b35] hover:border-[#f0b90b]/40"
  }`;

// Category is chosen via ?tab=<tabId>; the server page re-fetches the token list from Binance with that tabId.
export default function CategoryTabs({ active }: { active: number | null }) {
  const [open, setOpen] = useState(false);
  const activeMore = MORE_TABS.find((t) => t.id === active);

  return (
    <nav aria-label="Sector categories" className="px-4 sm:px-6 pb-3 flex items-center gap-2">
      <div className="flex gap-2 overflow-x-auto flex-1 min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link href="/" scroll={false} prefetch={false} aria-current={active == null ? "page" : undefined} className={chip(active == null)}>
          All
        </Link>
        {PRIMARY_TABS.map((t) => (
          <Link
            key={t.id}
            href={`/?tab=${t.id}`}
            scroll={false}
            prefetch={false}
            aria-current={active === t.id ? "page" : undefined}
            className={chip(active === t.id)}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Outside the scroll area so the menu is never clipped */}
      <div className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={chip(!!activeMore)}
        >
          {activeMore ? activeMore.label : "More"} ▾
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 z-30 w-52 max-h-72 overflow-y-auto rounded-xl border border-[#1b1b35] bg-[#0e0e1c] p-1 shadow-xl"
            >
              {MORE_TABS.map((t) => (
                <Link
                  key={t.id}
                  href={`/?tab=${t.id}`}
                  scroll={false}
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-xs font-bold ${
                    active === t.id ? "bg-[#f0b90b] text-black" : "text-[#94a3b8] hover:bg-[#1b1b35]"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
