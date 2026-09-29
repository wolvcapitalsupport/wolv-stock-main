import { getRWATokenList, getRWAMarketData, getRWAProfile } from "@/lib/binance";
import { quoteUsd } from "@/lib/quotes";
import Link from "next/link";
import { buildProtectionRows } from "@/lib/rwaData";
import GlobalNav from "@/components/GlobalNav";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: any) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const money = (v: any) => { const n = num(v); return n == null ? "—" : "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const big = (v: any) => {
  const n = num(v);
  if (n == null) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  return "$" + n.toLocaleString();
};
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const tone = (g: number | null) =>
  g == null ? "text-[#64748b]" : Math.abs(g) < 0.25 ? "text-green-400" : Math.abs(g) < 1 ? "text-yellow-400" : "text-red-400";

export default async function StockPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const tokens = await getRWATokenList();
  const token = tokens?.data?.find((t: any) => t.tokenContractAddress === address);

  if (!token) return (
    <div className="min-h-screen bg-[#07070f] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-[#64748b]">Token not found</p>
        <Link href="/" className="text-[#f0b90b] text-sm mt-4 block">← Back</Link>
      </div>
    </div>
  );

  const errs: string[] = [];
  await sleep(300);
  const market = await getRWAMarketData(address).catch((e: any) => { errs.push("market data: " + String(e?.message ?? e)); return null; });
  await sleep(300);
  const profile = await getRWAProfile(address).catch((e: any) => { errs.push("company profile: " + String(e?.message ?? e)); return null; });
  await sleep(300);
  const q = await quoteUsd(address);

  console.log("[profile-dump]", token.underlyingTicker, JSON.stringify(profile)?.slice(0, 1500));

  const md = market?.data?.marketData ?? {};
  const prof = profile?.data ?? null;
  const protectionRows = buildProtectionRows(prof);
  const mult = num(token.tokenToShareRatio) || 1;
  const listed = num(token.tokenPrice) ?? 0;
  const ref = num(token.referencePrice) ?? 0;
  const refShare = ref / mult; // referencePrice is per TOKEN
  const perShare = q.ok ? q.usd / mult : null;
  const gap = perShare != null && refShare > 0 ? (perShare / refShare - 1) * 100 : null;
  const isOpen = token.statusInfo?.openState;
  const status = token.statusInfo?.marketStatus ?? (isOpen ? "trading" : "closed");

  const profRows: [string, any][] = prof && typeof prof === "object"
    ? Object.entries(prof).filter(([k, v]) =>
        (typeof v === "string" || typeof v === "number") && String(v).trim() !== "" && !/logo|chain|address|url|id$|^assetType$|^underlyingTicker$|ratio/i.test(k))
    : [];
  const shortRows = profRows.filter(([, v]) => String(v).length <= 120);
  const longRows = profRows.filter(([, v]) => String(v).length > 120);

  const stats: [string, string][] = [
    ["P/E Ratio (TTM)", num(md.peRatioTTM ?? token.peRatioTTM) != null ? num(md.peRatioTTM ?? token.peRatioTTM)!.toFixed(2) : "—"],
    ["Market Cap", big(md.marketCap ?? token.marketCap)],
    ["24H Volume", big(token.volume24H)],
    ["52W High", money(md.high52W)],
    ["52W Low", money(md.low52W)],
    ["Dividend Yield", num(md.dividendYield) != null ? num(md.dividendYield)!.toFixed(2) + "%" : "—"],
    ["Latest Dividend", money(md.latestDividend)],
  ];

  return (
    <main className="min-h-screen bg-[#07070f] text-white pb-10">
      <nav className="border-b border-[#1b1b35] bg-[#0e0e1c] px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="text-[#64748b] text-xl">←</Link>
        {token.tokenLogoUrl && <img src={token.tokenLogoUrl} className="w-8 h-8 rounded-full" alt={token.underlyingTicker} />}
        <div className="min-w-0">
          <div className="font-black text-lg">{token.underlyingTicker}</div>
          <div className="text-xs text-[#64748b] truncate">{token.underlyingName || token.tokenName?.replace(/\s*\(.*?\)\s*/g, "")}</div>
        </div>
        <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full border ${
          isOpen ? "bg-green-900/30 text-green-400 border-green-800" : "bg-yellow-900/20 text-yellow-400 border-yellow-800"
        }`}>
          {String(status).toUpperCase()}
        </span>
      </nav>

      <div className="mb-6">
        <Link
          href={`/trade/${address}`}
          className="w-full bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-bold py-3 px-6 rounded-xl text-lg flex items-center justify-center gap-2 transition-colors"
        >
          Trade This Asset
          <span className="text-xs">→</span>
        </Link>
      </div>

      <div className="px-4 sm:px-6 pt-6 space-y-4">
        <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-5">
          <div className="text-xs text-[#64748b] mb-1 uppercase tracking-wider">Listed price (per token)</div>
          <div className="text-4xl font-black text-white mb-1">
            ${listed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
          </div>
          <div className="text-xs text-[#64748b]">
            via {token.platformId} · BSC · 1 token = {mult.toFixed(4)} shares
          </div>
        </div>

        <div className="rounded-xl p-5 border border-[#1b1b35] bg-[#0e0e1c]">
          <div className="text-xs text-[#64748b] mb-3 uppercase tracking-wider">Executable vs reference (per share)</div>
          {q.ok ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <div className="text-xs text-[#64748b] mb-1">Executable</div>
                  <div className="font-bold text-sm">${perShare!.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">Reference</div>
                  <div className="font-bold text-sm">${refShare.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">Gap</div>
                  <div className={`font-black text-lg ${tone(gap)}`}>
                    {gap == null ? "—" : (gap > 0 ? "+" : "") + gap.toFixed(3) + "%"}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#64748b] leading-relaxed">
                What 100 USDT buys through the router ({q.vendor} {q.mode}), divided by the {mult.toFixed(4)} shares per token.
                Reference price is a per-share value derived from the on-chain token price according to Binance&apos;s RWA data;
                it is not an independent stock-market quote. Executable price reflects what the aggregator currently quotes for the token.
              </div>
            </>
          ) : (
            <div className="text-xs text-yellow-500">Quote unavailable: {q.err}</div>
          )}
        </div>

        <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-5">
          <div className="text-xs text-[#64748b] mb-3 uppercase tracking-wider">Market Data</div>
          <div className="space-y-3">
            {stats.map(([l, v]) => (
              <div key={l} className="flex justify-between text-sm border-b border-[#1b1b35] pb-2 last:border-none last:pb-0">
                <span className="text-[#64748b]">{l}</span>
                <span className="font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-5">
          <div className="text-xs text-[#64748b] mb-3 uppercase tracking-wider">Company</div>
          {profRows.length === 0 ? (
            <div className="text-xs text-[#64748b]">No company details returned for this token.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {shortRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-[#1b1b35] pb-2 last:border-none">
                  <span className="text-[#64748b]">{label(k)}</span>
                  <span className="font-bold text-right max-w-[60%]">{String(v)}</span>
                </div>
              ))}
              {longRows.map(([k, v]) => (
                <p key={k} className="text-xs text-[#94a3b8] leading-relaxed pt-2">{String(v)}</p>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-5">
          <div className="text-xs text-[#64748b] mb-1 uppercase tracking-wider">Protections &amp; Reports</div>
          <p className="text-xs text-[#94a3b8] leading-relaxed mb-3">
            Investor protection and reporting information supplied through the RWA profile.
          </p>
          {protectionRows.length === 0 ? (
            <div className="text-xs text-[#64748b]">No protection reports currently available.</div>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                {protectionRows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between gap-4 border-b border-[#1b1b35] pb-2 last:border-none last:pb-0">
                    <span className="text-[#64748b]">{r.label}</span>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#f0b90b] text-right">
                        View report ↗
                      </a>
                    ) : (
                      <span className="text-xs text-[#64748b] text-right">Listed · no report link provided</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#64748b] mt-3 leading-relaxed">
                Reports are published by the issuing platform. WOLV does not verify their contents.
              </p>
            </>
          )}
        </div>

        {errs.length > 0 && (
          <div className="text-xs text-yellow-500 bg-yellow-900/10 border border-yellow-800/40 rounded-xl p-3">
            {errs.map((e) => <div key={e}>{e}</div>)}
          </div>
        )}

        <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-4 flex items-center justify-between">
          <div className="text-xs text-[#64748b]">Issued by</div>
          <span className="text-sm font-bold capitalize text-[#f0b90b]">{token.platformId}</span>
        </div>

        <GlobalNav />
      </div>
    </main>
  );
}
