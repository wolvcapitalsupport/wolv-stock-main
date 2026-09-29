import Link from "next/link";
import { getRWATokenList } from "@/lib/binance";
import { quoteUsd } from "@/lib/quotes";
import GlobalNav from "@/components/GlobalNav";

export const dynamic = "force-dynamic";

const num = (v: any) => parseFloat(v ?? "0") || 0;
const tone = (x: number | null) =>
  x == null ? "text-[#64748b]" : Math.abs(x) < 0.25 ? "text-green-400" : Math.abs(x) < 1 ? "text-yellow-400" : "text-red-400";
const sgn = (x: number) => (x > 0 ? "+" : "") + x.toFixed(3) + "%";

export default async function GapPage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const { n } = await searchParams;
  const limit = Math.min(40, Math.max(1, parseInt(n ?? "8") || 8));
  const tokens = await getRWATokenList();
  const all: any[] = tokens?.data ?? [];

  const by: Record<string, Record<string, any>> = {};
  for (const t of all) {
    if (!t.underlyingTicker) continue;
    (by[t.underlyingTicker] ||= {})[t.platformId] ||= t;
  }
  const pairs = Object.entries(by)
    .filter(([, v]) => Object.keys(v).length >= 2)
    .map(([ticker, v]) => ({ ticker, venues: Object.values(v) as any[] }))
    .sort((a, b) => Math.max(...b.venues.map((x) => num(x.volume24H))) - Math.max(...a.venues.map((x) => num(x.volume24H))));
  const shown = pairs.slice(0, limit);

  const rows: any[] = [];
  for (const p of shown) {
    const vs: any[] = [];
    for (const t of p.venues) {
      const q = await quoteUsd(t.tokenContractAddress);
      const mult = num(t.tokenToShareRatio) || 1;
      const ref = num(t.referencePrice);
      const refShare = ref / mult; // referencePrice is per TOKEN
      const perShare = q.ok ? q.usd / mult : null;
      const gap = perShare != null && refShare > 0 ? (perShare / refShare - 1) * 100 : null;
      vs.push({ t, q, mult, ref, refShare, perShare, gap });
    }
    const ps = vs.map((v) => v.perShare).filter((x): x is number => x != null);
    const spread = ps.length >= 2 ? (Math.max(...ps) / Math.min(...ps) - 1) * 100 : null;
    rows.push({ ticker: p.ticker, vs, spread });
  }

  const odd = all
    .filter((t) => Math.abs(num(t.tokenToShareRatio) - 1) > 0.5)
    .sort((a, b) => Math.abs(num(b.tokenToShareRatio) - 1) - Math.abs(num(a.tokenToShareRatio) - 1));

  return (
    <main className="min-h-screen bg-[#07070f] text-white pb-10">
      <nav className="border-b border-[#1b1b35] bg-[#0e0e1c] px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="text-[#64748b] text-xl">←</Link>
        <div>
          <div className="font-black text-lg">📊 Listed vs Executable Price</div>
          <div className="text-xs text-[#64748b]">What tokenized stocks really cost · updated {new Date().toISOString().slice(11, 19)} UTC</div>
        </div>
      </nav>

      <div className="px-4 sm:px-6 pt-6">
        <p className="text-xs text-[#94a3b8] mb-4 leading-relaxed">
          Listed prices are per token, and each token represents a multiplier of shares. This page asks the router what
          100 USDT actually buys, converts that to a per-share price, and compares it with the reference price. Reference price is a
          per-share value derived from the on-chain token price according to Binance&apos;s RWA data; it is not an independent
          stock-market quote. Executable price reflects what the aggregator currently quotes for the token.
        </p>
        <div className="text-xs text-[#64748b] mb-3 uppercase tracking-wider font-bold">
          Top {shown.length} of {pairs.length} cross-listed tickers by volume · add ?n=40 for all (slower)
        </div>

        <div className="space-y-3 mb-8">
          {rows.map((r) => (
            <div key={r.ticker} className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="font-bold text-sm">{r.ticker}</div>
                <div className={`text-xs font-bold text-right ${tone(r.spread)}`}>
                  {r.spread == null ? "spread n/a" : `${r.spread.toFixed(3)}% cross-venue spread (per share)`}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {r.vs.map((v: any) => (
                  <Link
                    key={v.t.tokenContractAddress}
                    href={`/stock/${v.t.tokenContractAddress}`}
                    className="block rounded-lg p-3 border border-[#1b1b35] hover:border-[#f0b90b]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {v.t.tokenLogoUrl && <img src={v.t.tokenLogoUrl} className="w-5 h-5 rounded-full" alt={r.ticker} />}
                      <span className="text-xs text-[#64748b] capitalize">{v.t.platformId}</span>
                      <span className="text-[10px] text-[#64748b] ml-auto">
                        {v.t.statusInfo?.marketStatus ?? (v.t.statusInfo?.openState ? "open" : "closed")}
                      </span>
                    </div>
                    {v.q.ok ? (
                      <>
                        <div className="font-black text-sm">
                          ${v.perShare.toFixed(3)} <span className="text-xs text-[#64748b] font-normal">per share, executable</span>
                        </div>
                        <div className="text-xs text-[#64748b]">reference ${v.refShare.toFixed(3)}</div>
                        {v.gap != null && <div className={`text-xs font-bold ${tone(v.gap)}`}>gap {sgn(v.gap)}</div>}
                        <div className="text-[10px] text-[#64748b] mt-1">
                          {v.mult.toFixed(4)}× shares/token · {v.q.vendor} {v.q.mode} · {Math.round((Date.now() - v.q.ts) / 1000)}s old
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-yellow-500">Quote unavailable: {v.q.err}</div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-[#64748b] mb-3 uppercase tracking-wider font-bold">
          Unusual share multipliers ({odd.length}) — likely splits or corporate actions
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {odd.map((t) => (
            <Link key={t.tokenContractAddress} href={`/stock/${t.tokenContractAddress}`}
              className="bg-[#0e0e1c] border border-[#1b1b35] rounded-lg p-3 text-xs hover:border-[#f0b90b]/30 transition-colors">
              <div className="font-bold">{t.underlyingTicker} <span className="text-[#64748b] font-normal capitalize">{t.platformId}</span></div>
              <div className="text-[#f0b90b] font-black">{num(t.tokenToShareRatio).toFixed(3)}× shares/token</div>
            </Link>
          ))}
        </div>
      </div>

      <GlobalNav />
    </main>
  );
}
