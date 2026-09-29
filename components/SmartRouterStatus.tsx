import { getRWATokenList } from "@/lib/binance";
import { isAssetCompliant } from "@/lib/compliance";
import { quoteUsd } from "@/lib/quotes";

function normalizePlatform(platformId?: string | null) {
  const value = (platformId ?? "").trim().toLowerCase();
  if (!value) return "Protocol";
  if (value.includes("ondo")) return "Ondo";
  if (value.includes("stock") || value.includes("bstock")) return "bStocks";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function SmartRouterStatus({ ticker }: { ticker: string }) {
  const symbol = (ticker ?? "").trim().toUpperCase();
  if (!symbol) {
    return null;
  }

  const compliant = isAssetCompliant(symbol);

  let rows: any[] = [];

  try {
    const list = await getRWATokenList();
    const matches = ((list?.data ?? []) as any[])
      .filter((token) => (token?.underlyingTicker ?? "").trim().toUpperCase() === symbol)
      .filter((token) => {
        const platform = (token?.platformId ?? "").trim().toLowerCase();
        return platform.includes("ondo") || platform.includes("stock") || platform.includes("bstock");
      });

    rows = await Promise.all(
      matches.map(async (token) => {
        const q = await quoteUsd(token.tokenContractAddress, 100);
        const platform = normalizePlatform(token.platformId);
        const effectiveUsd = q.ok ? q.usd : null;
        const feeEstimate = q.ok ? Number(q.impact ?? 0) : null;

        return {
          platform,
          tokenContractAddress: token.tokenContractAddress,
          effectiveUsd,
          feeEstimate,
          quoteStatus: q.ok ? "Live" : "Delayed",
          quoteError: q.ok ? null : q.err,
        };
      })
    );
  } catch {
    rows = [];
  }

  const ranked = [...rows].filter((row) => row.effectiveUsd != null).sort((a, b) => (a.effectiveUsd ?? Infinity) - (b.effectiveUsd ?? Infinity));
  const best = ranked[0] ?? rows[0];
  const badgeText = compliant
    ? "🛡️ 100% Spot Verified (Derivatives Disabled)"
    : "⚠️ Symbol Not Spot Compliant";

  return (
    <div className="mb-6 rounded-2xl border border-[#1b1b35] bg-[#0e0e1c] p-4 shadow-[0_0_0_1px_rgba(240,185,11,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94a3b8]">Protocol routing</div>
          <div className="mt-1 text-xl font-black text-white">WOLV Smart Router</div>
        </div>
        <div className="inline-flex items-center rounded-full border border-[#16a34a]/40 bg-[#14532d]/40 px-3 py-1.5 text-xs font-bold text-[#bbf7d0]">
          {badgeText}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#f0b90b]/30 bg-[#f0b90b]/5 p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[#94a3b8]">Best execution for {symbol}</span>
          <span className="rounded-full border border-[#f0b90b]/40 bg-[#f0b90b]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#f0b90b]">
            {best ? `${best.platform} preferred` : "Awaiting quotes"}
          </span>
        </div>
        <div className="mt-2 text-2xl font-black text-[#f0b90b]">
          {best && best.effectiveUsd != null ? `$${best.effectiveUsd.toFixed(2)}` : "Quote pending"}
        </div>
        <div className="mt-1 text-xs text-[#94a3b8]">
          {best && best.feeEstimate != null
            ? `${best.feeEstimate.toFixed(3)}% estimated route fee / spread`
            : best?.quoteError ?? "Comparing live routes from bStocks and Ondo"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.length > 0 ? (
          rows.map((row) => {
            const selected = row.tokenContractAddress === best?.tokenContractAddress;
            return (
              <div
                key={row.tokenContractAddress}
                className={`rounded-xl border p-3 transition-all ${
                  selected
                    ? "border-[#f0b90b]/60 bg-[#f0b90b]/10 shadow-[0_0_0_1px_rgba(240,185,11,0.2)]"
                    : "border-[#1b1b35] bg-[#0b0b17]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{row.platform}</span>
                  {selected && (
                    <span className="rounded-full border border-[#f0b90b]/40 bg-[#f0b90b]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#f0b90b]">
                      Best price
                    </span>
                  )}
                </div>

                <div className="mt-3 text-xl font-black text-white">
                  {row.effectiveUsd != null ? `$${row.effectiveUsd.toFixed(2)}` : "—"}
                </div>

                <div className="mt-1 text-xs text-[#94a3b8]">
                  {row.feeEstimate != null ? `${row.feeEstimate.toFixed(3)}% cost` : "Fee estimate unavailable"}
                </div>

                <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#64748b]">
                  {row.quoteStatus}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-[#1b1b35] bg-[#0b0b17] p-3 text-sm text-[#94a3b8] sm:col-span-2">
            No direct bStocks/Ondo quotes were found for {symbol}. Routing is paused until a compliant pair is available.
          </div>
        )}
      </div>
    </div>
  );
}
