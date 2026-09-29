import Link from "next/link";
import { getRWATokenList, getRWAPlatforms } from "@/lib/binance";
import { useMemo, useState } from "react";
import StockList from "@/components/StockList";
import CategoryTabs from "@/components/CategoryTabs";
import { RWA_TABS, parseTabId } from "@/lib/rwaData";
import GlobalNav from "@/components/GlobalNav";

export const dynamic = "force-dynamic";

export default async function Trade({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const tabId = parseTabId(tab); // null = All (no tabId sent to Binance)
  const tabLabel = RWA_TABS.find((t) => t.id === tabId)?.label;
  const [platforms, list] = await Promise.all([
    getRWAPlatforms(),
    getRWATokenList(undefined, tabId ?? undefined)
      .then((data: any) => ({ data, err: null as string | null }))
      .catch((e: any) => ({ data: null as any, err: String(e?.message ?? e).slice(0, 160) })),
  ]);
  const tokens = list.data;
  const allTokens: any[] = tokens?.data ?? [];
  const slim = allTokens.map((t) => ({
    tokenContractAddress: t.tokenContractAddress,
    tokenLogoUrl: t.tokenLogoUrl,
    underlyingTicker: t.underlyingTicker,
    underlyingName: t.underlyingName,
    tokenName: t.tokenName,
    platformId: t.platformId,
    tags: Array.isArray(t.tags) ? t.tags : [],
  }));

  return (
    <main className="min-h-screen bg-[#07070f] text-white">
      <nav className="border-b border-[#1b1b35] bg-[#0e0e1c] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#f0b90b] flex items-center justify-center font-black text-black text-sm">W</div>
          <span className="font-bold text-lg tracking-wide">WOLV Stock Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-[#64748b] hover:text-white">
            ← Home
          </Link>
          <span className="text-xs text-[#64748b]">/</span>
          <Link href="/trade" className="font-bold text-[#f0b90b]">
            Trade
          </Link>
        </div>
      </nav>

      <div className="px-4 sm:px-6 py-4 flex gap-3 overflow-x-auto">
        {platforms?.data?.map((p: any) => (
          <div key={p.platformId} className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <img src={p.logoUrl} className="w-5 h-5 rounded-full" alt={p.platformId} />
              <span className="font-bold text-sm capitalize">{p.platformId}</span>
            </div>
            <div className="text-[#f0b90b] font-black text-xl">{allTokens.filter((t) => t.platformId === p.platformId).length}</div>
            <div className="text-[#64748b] text-xs">on BSC</div>
          </div>
        ))}
        <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl px-4 py-3 flex-shrink-0">
          <div className="text-[#64748b] text-xs mb-1">Total Available</div>
          <div className="text-[#f0b90b] font-black text-xl">{allTokens.length}</div>
          <div className="text-[#64748b] text-xs">on BSC chain</div>
        </div>
      </div>

      <CategoryTabs active={tabId} />

      {list.err && (
        <div className="mx-4 sm:mx-6 mb-3 text-xs text-yellow-500 bg-yellow-900/10 border border-yellow-800/40 rounded-xl p-3">
          Couldn&apos;t load {tabLabel ?? "the token list"}: {list.err}
          {tabId != null && (
            <> · <Link href="/trade" className="underline">show all</Link></>
          )}
        </div>
      )}

      <div className="px-4 sm:px-6 pb-10">
        <h2 className="mb-4 text-xl font-bold text-center">Select an Asset to Trade</h2>
        <StockList key={tabId ?? "all"} tokens={slim} category={tabLabel} />
      </div>

      <GlobalNav />
    </main>
  );
}