import fs from "fs";
import crypto from "crypto";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const KEY = env.BINANCE_API_KEY, SECRET = env.BINANCE_SECRET_KEY;
if (!KEY || !SECRET) { console.error("Missing BINANCE_API_KEY / BINANCE_SECRET_KEY in .env.local"); process.exit(1); }

const BASE = "https://web3.binance.com/build";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const N = 8, EVERY_MS = 5 * 60 * 1000, USDT_IN = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

async function get(path, params = {}) {
  const wait = Math.max(0, last + 300 - Date.now());
  if (wait) await sleep(wait);
  last = Date.now();
  const q = new URLSearchParams(params).toString();
  const full = q ? `${path}?${q}` : path;
  const ts = new Date().toISOString();
  const sig = crypto.createHmac("sha256", SECRET).update(ts + "GET" + "/build" + full, "utf8").digest("base64");
  const res = await fetch(BASE + full, { headers: { "X-OC-APIKEY": KEY, "X-OC-TIMESTAMP": ts, "X-OC-SIGN": sig } });
  const j = await res.json();
  if (!j.success && j.code !== 0) throw new Error(`API error ${j.code}: ${j.msg}`);
  return j;
}

async function quote(addr) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await get("/api/v1/dex/aggregator/quote", {
        binanceChainId: "56",
        fromTokenAddress: USDT,
        toTokenAddress: addr,
        amount: String(USDT_IN) + "0".repeat(18),
        userWalletAddress: "0x000000000000000000000000000000000000dEaD",
      });
      const routes = (r.data ?? []).filter((x) => x?.toTokenAmount);
      routes.sort((a, b) => Number(b.toTokenAmount) - Number(a.toTokenAmount));
      const b = routes[0];
      if (!b) throw new Error(r.msg || "no route");
      const out = Number(b.toTokenAmount) / 1e18;
      const px = parseFloat(b.fromToken?.tokenUnitPrice ?? "1") || 1;
      return { execUsd: (USDT_IN * px) / out, vendor: b.vendorName, mode: b.executionMode, impact: b.priceImpactPercent, routes: routes.length };
    } catch (e) {
      const m = String(e.message ?? e);
      if (i === 0 && m.includes("42900")) { await sleep(1500); continue; }
      return { err: m.slice(0, 160) };
    }
  }
  return { err: "rate limited" };
}

let picked = null;
async function cycle() {
  const list = (await get("/api/v1/dex/market/rwa/tokens")).data ?? [];
  if (!picked) {
    const by = {};
    for (const t of list) if (t.underlyingTicker) ((by[t.underlyingTicker] ??= {})[t.platformId] ??= t);
    const vol = (v) => Math.max(...Object.values(v).map((x) => Number(x.volume24H) || 0));
    picked = Object.entries(by)
      .filter(([, v]) => Object.keys(v).length >= 2)
      .sort((a, b) => vol(b[1]) - vol(a[1]))
      .slice(0, N)
      .map(([tk]) => tk);
    console.log("tracking:", picked.join(","));
  }
  const ts = new Date().toISOString();
  let ok = 0, bad = 0;
  const lines = [];
  for (const tk of picked) {
    const seen = new Set();
    for (const t of list) {
      if (t.underlyingTicker !== tk || seen.has(t.platformId)) continue;
      seen.add(t.platformId);
      const q = await quote(t.tokenContractAddress);
      const mult = parseFloat(t.tokenToShareRatio) || 1;
      lines.push(JSON.stringify({
        ts, tk, plat: t.platformId,
        listUsd: Number(t.tokenPrice), ref: Number(t.referencePrice), mult,
        mkt: t.statusInfo?.marketStatus ?? null, open: t.statusInfo?.openState ?? null, reason: t.statusInfo?.reasonCode ?? null,
        ...q, execPerShare: q.execUsd ? q.execUsd / mult : null,
      }));
      q.err ? bad++ : ok++;
    }
  }
  fs.mkdirSync("data", { recursive: true });
  fs.appendFileSync("data/snapshots.jsonl", lines.join("\n") + "\n");
  console.log(ts, "quotes ok:", ok, "err:", bad);
}

const once = process.argv.includes("--once");
process.on("unhandledRejection", (e) => console.log("unhandled:", String(e)));
while (true) {
  const t0 = Date.now();
  try { await cycle(); } catch (e) { console.log(new Date().toISOString(), "cycle error:", String(e.message ?? e)); }
  if (once) break;
  await sleep(Math.max(1000, EVERY_MS - (Date.now() - t0)));
}
