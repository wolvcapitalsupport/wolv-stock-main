import fs from "fs";
import crypto from "crypto";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const BASE = "https://web3.binance.com/build";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, params = {}) {
  await sleep(350);
  const q = new URLSearchParams(params).toString();
  const full = q ? `${path}?${q}` : path;
  const ts = new Date().toISOString();
  const sig = crypto.createHmac("sha256", env.BINANCE_SECRET_KEY).update(ts + "GET" + "/build" + full, "utf8").digest("base64");
  const r = await fetch(BASE + full, { headers: { "X-OC-APIKEY": env.BINANCE_API_KEY, "X-OC-TIMESTAMP": ts, "X-OC-SIGN": sig } });
  const j = await r.json();
  if (!j.success && j.code !== 0) throw new Error(`API error ${j.code}: ${j.msg}`);
  return j;
}
async function execTok(addr) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await get("/api/v1/dex/aggregator/quote", {
        binanceChainId: "56", fromTokenAddress: USDT, toTokenAddress: addr,
        amount: "100" + "0".repeat(18), userWalletAddress: "0x000000000000000000000000000000000000dEaD",
      });
      const rt = (r.data ?? []).filter((x) => x?.toTokenAmount).sort((a, b) => Number(b.toTokenAmount) - Number(a.toTokenAmount));
      if (!rt[0]) return null;
      const px = parseFloat(rt[0].fromToken?.tokenUnitPrice ?? "1") || 1;
      return (100 * px) / (Number(rt[0].toTokenAmount) / 1e18);
    } catch (e) {
      if (i === 0 && String(e).includes("42900")) { await sleep(1500); continue; }
      return null;
    }
  }
  return null;
}
const list = (await get("/api/v1/dex/market/rwa/tokens")).data ?? [];
const odd = list.filter((t) => Math.abs(parseFloat(t.tokenToShareRatio) - 1) > 0.5).slice(0, 40);
console.log("odd-multiplier tokens:", odd.length);
for (const t of odd) {
  const m = parseFloat(t.tokenToShareRatio), lp = parseFloat(t.tokenPrice), rf = parseFloat(t.referencePrice);
  const ex = await execTok(t.tokenContractAddress);
  if (!ex) { console.log(t.underlyingTicker, t.platformId, "mult", m.toFixed(3), "no quote"); continue; }
  const a = ex / lp, b = ex / rf;
  const v = Math.abs(a - 1) < 0.03 ? "list matches trade" : Math.abs(b - 1) < 0.03 ? "REFERENCE matches trade (per-token)" : "neither";
  console.log(t.underlyingTicker, t.platformId, "mult", m.toFixed(3), "exec/list", a.toFixed(3), "exec/ref", b.toFixed(3), "=>", v);
}
