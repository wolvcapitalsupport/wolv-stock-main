const SPOT_TRADING_ONLY_BLACKLIST = new Set(["SOXL", "KORU", "MUU"]);

export function isAssetCompliant(symbol: string): boolean {
  if (typeof symbol !== "string") return false;

  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return false;

  return !SPOT_TRADING_ONLY_BLACKLIST.has(normalized);
}

export function filterCompliantAssets<T extends { underlyingTicker?: string | null; symbol?: string | null }>(assets: T[]): T[] {
  return assets.filter((asset) => {
    const symbol = asset?.underlyingTicker ?? asset?.symbol ?? "";
    return isAssetCompliant(symbol);
  });
}
