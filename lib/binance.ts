import crypto from "crypto";

let lastCall = 0;
async function rateLimit() {
  const now = Date.now();
  const diff = now - lastCall;
  if (diff < 250) await new Promise(r => setTimeout(r, 250 - diff));
  lastCall = Date.now();
}

const API_KEY = process.env.BINANCE_API_KEY!;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY!;
const BASE_URL = "https://web3.binance.com/build";

function makeHeaders(method: string, path: string, body = "") {
  const timestamp = new Date().toISOString();
  const requestPath = "/build" + path;
  const preHash = timestamp + method.toUpperCase() + requestPath + body;
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(preHash, "utf8")
    .digest("base64");
  return {
    "X-OC-APIKEY": API_KEY,
    "X-OC-TIMESTAMP": timestamp,
    "X-OC-SIGN": signature,
    "X-OC-RECV-WINDOW": "60000",
  };
}

async function get(path: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const fullPath = query ? `${path}?${query}` : path;
  const headers = makeHeaders("GET", fullPath);
  await rateLimit();
  const res = await fetch(`${BASE_URL}${fullPath}`, {
    headers,
    next: { revalidate: 60 },
  });
  const json = await res.json();
  if (!json.success && json.code !== 0) {
    throw new Error(`API error ${json.code}: ${json.msg}`);
  }
  return json;
}

// RWA — list all tokenized stocks
// Optional filters per Binance RWA Data docs: platformId (ondo | bstock) and tabId (sector tab, integer).
// With no arguments the request is unchanged (complete list).
export async function getRWATokenList(platform?: string, tabId?: number) {
  const params: Record<string, string> = {};
  if (platform) params.platformId = platform;
  if (tabId != null) params.tabId = String(tabId);
  return get("/api/v1/dex/market/rwa/tokens", params);
}

// RWA — price for specific tokens
export async function getRWAPrice(contractAddresses: string[], chainId = "56") {
  return get("/api/v1/dex/market/rwa/price", {
    binanceChainId: chainId,
    tokenContractAddresses: contractAddresses.join(","),
  });
}

// RWA — search by keyword
export async function searchRWA(keyword: string) {
  return get("/api/v1/dex/market/rwa/search", { keyword });
}

// RWA — underlying company info
export async function getRWAProfile(contractAddress: string, chainId = "56") {
  return get("/api/v1/dex/market/rwa/underlying-profile", {
    binanceChainId: chainId,
    tokenContractAddress: contractAddress,
  });
}

// RWA — underlying market data (real stock price, P/E, 52w range)
export async function getRWAMarketData(contractAddress: string, chainId = "56") {
  return get("/api/v1/dex/market/rwa/underlying-market", {
    binanceChainId: chainId,
    tokenContractAddress: contractAddress,
  });
}

// RWA — issuance platforms (Ondo etc.)
export async function getRWAPlatforms() {
  return get("/api/v1/dex/market/rwa/platforms");
}

// Candlestick chart data
export async function getCandles(
  contractAddress: string,
  chainId = "56",
  bar = "1h",
  limit = "48"
) {
  return get("/api/v1/dex/market/candles", {
    binanceChainId: chainId,
    tokenContractAddress: contractAddress,
    bar,
    limit,
  });
}

// Aggregated quote (read-only): price to buy `toToken` with USDT on BSC
export async function getRWAQuote(
  toToken: string,
  amount = "100000000000000000000",
  wallet = "0x000000000000000000000000000000000000dEaD"
) {
  return get("/api/v1/dex/aggregator/quote", {
    binanceChainId: "56",
    fromTokenAddress: "0x55d398326f99059fF775485246999027B3197955",
    toTokenAddress: toToken,
    amount,
    userWalletAddress: wallet,
  });
}

// ===== VERIFIED RWA TRADING ENDPOINTS (Phase 2) =====

// Aggregated quote (trading): price to buy `toToken` with USDT on BSC
// Requires userWalletAddress for RWA/RFQ quotes
export async function getAggregatorQuote(
  toToken: string,
  amount: string,
  userWalletAddress: string
) {
  return get("/api/v1/dex/aggregator/quote", {
    binanceChainId: "56",
    fromTokenAddress: "0x55d398326f99059fF775485246999027B3197955",
    toTokenAddress: toToken,
    amount,
    userWalletAddress, // Required for RWA/RFQ
  });
}

// Get swap details for a quote
export async function getAggregatorSwap(
  toToken: string,
  amount: string,
  userWalletAddress: string,
  quoteId: string,
  slippagePercent: string = "0.5"
) {
  return get("/api/v1/dex/aggregator/swap", {
    binanceChainId: "56",
    fromTokenAddress: "0x55d398326f99059fF775485246999027B3197955",
    toTokenAddress: toToken,
    amount,
    userWalletAddress,
    quoteId,
    slippagePercent,
  });
}

// Get approval transaction calldata
export async function getApproveTransaction(
  tokenContractAddress: string,
  approveAmount: string,
  userWalletAddress: string,
  vendor?: string // Optional vendor parameter for RFQ routes
) {
  const params: Record<string, string> = {
    binanceChainId: "56",
    tokenContractAddress,
    approveAmount,
  };

  if (vendor) {
    params.vendor = vendor;
  }

  return get("/api/v1/dex/aggregator/approve-transaction", params);
}

// Submit a signed order
export async function submitOrder(
  requestId: string, // UUID v4 idempotency key
  userSignature: string, // EIP-712 signature of rfq.typedDataToSign
  vendor: string, // Must match rfq.vendor from swap response
  quoteId: string // rfq.orderId from /swap response
) {
  // Note: This is a POST request with JSON body
  const timestamp = new Date().toISOString();
  const path = "/api/v1/dex/aggregator/order/submit";
  const requestPath = "/build" + path;
  const body = JSON.stringify({
    requestId,
    userSignature,
    vendor,
    quoteId,
    // signingScheme is optional per docs
  });

  const preHash = timestamp + "POST" + requestPath + body;
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(preHash, "utf8")
    .digest("base64");

  const headers = {
    "X-OC-APIKEY": API_KEY,
    "X-OC-TIMESTAMP": timestamp,
    "X-OC-SIGN": signature,
    "Content-Type": "application/json",
  };

  await rateLimit();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body,
    // No next: { revalidate } for POST requests
  });

  const json = await res.json();
  if (!json.success && json.code !== 0) {
    throw new Error(`API error ${json.code}: ${json.msg}`);
  }
  return json;
}

// Get order status by orderId
export async function getOrderStatus(orderId: string) {
  return get(`/api/v1/dex/aggregator/order/${orderId}`, {});
}