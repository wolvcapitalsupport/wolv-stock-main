import { getRWAQuote } from "@/lib/binance";

export type Q =
  | { ok: true; usd: number; mode: string; vendor: string; impact: string; ts: number }
  | { ok: false; err: string; ts: number };

const cache = new Map<string, Q>();
const TTL = 30_000; // quotes live ~30s per the docs
let last = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// USD price of ONE TOKEN, from what `usdt` USDT actually buys (best route).
export async function quoteUsd(addr: string, usdt = 100): Promise<Q> {
  const hit = cache.get(addr);
  if (hit && Date.now() - hit.ts < TTL) return hit;
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = Math.max(0, last + 300 - Date.now()); // stay under 5 req/s
    if (wait) await sleep(wait);
    last = Date.now();
    try {
      const r: any = await getRWAQuote(addr, String(usdt) + "0".repeat(18));
      const routes: any[] = (r?.data ?? []).filter((x: any) => x?.toTokenAmount);
      routes.sort((a, b) => Number(b.toTokenAmount) - Number(a.toTokenAmount));
      const best = routes[0];
      if (!best) throw new Error(r?.msg || "no route");
      const out = Number(best.toTokenAmount) / 1e18;
      const usdtPx = parseFloat(best.fromToken?.tokenUnitPrice ?? "1") || 1;
      const q: Q = {
        ok: true,
        usd: (usdt * usdtPx) / out,
        mode: best.executionMode,
        vendor: best.vendorName,
        impact: best.priceImpactPercent,
        ts: Date.now(),
      };
      cache.set(addr, q);
      return q;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (attempt === 0 && msg.includes("42900")) { await sleep(1200); continue; }
      const q: Q = { ok: false, err: msg.slice(0, 140), ts: Date.now() };
      cache.set(addr, q);
      return q;
    }
  }
  return { ok: false, err: "rate limited", ts: Date.now() };
}
