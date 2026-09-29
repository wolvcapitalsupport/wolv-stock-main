// Pure helpers for the Binance RWA Data API (no server-only imports, so client components can use them).
// Source of truth: https://web3.binance.com/en/dev-docs/catalog/web3-wallet/api/rest-api/rwa-data

export type RwaTab = { id: number; label: string };

// Sector tabs for GET /api/v1/dex/market/rwa/tokens?tabId=<id>.
// Which tokens belong to a tab is decided by Binance, never hardcoded here.
export const PRIMARY_TABS: RwaTab[] = [
  { id: 2, label: "SpaceX" },
  { id: 3, label: "Upcoming Earnings" },
  { id: 4, label: "AI Chips" },
  { id: 9, label: "Mag 7" },
  { id: 11, label: "ETF" },
];

export const MORE_TABS: RwaTab[] = [
  { id: 5, label: "Storage" },
  { id: 6, label: "Energy" },
  { id: 7, label: "Precious Metals" },
  { id: 8, label: "China ADR" },
  { id: 10, label: "Crypto" },
  { id: 12, label: "Tech Leaders" },
  { id: 13, label: "Buffett Portfolio" },
  { id: 1, label: "Serenity Call" }, // documented as tabId 1
];

export const RWA_TABS: RwaTab[] = [...PRIMARY_TABS, ...MORE_TABS];

// Accepts the raw ?tab= value; returns a documented tabId or null (= All).
export function parseTabId(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return RWA_TABS.some((t) => t.id === n) ? n : null;
}

// Documented token tags (token-list `tags` field). Anything else is ignored.
export const TAG_LABELS: Record<string, string> = {
  alpha: "Alpha",
  communityRecognized: "Community Recognized",
  volumeSurge: "Volume Surge",
  volumePlunge: "Volume Plunge",
};

export function knownTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags.filter((t): t is string => typeof t === "string" && t in TAG_LABELS)));
}

// ---- Protections & Reports (underlying-profile `data.protections`) ----
const KNOWN_PROTECTIONS: [string, string][] = [
  ["dailyAttestationReport", "Daily Attestation Report"],
  ["monthlyAttestationReport", "Monthly Attestation Report"],
  ["collateralReport", "Collateral Report"],
];

const prettyKey = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function safeReportUrl(u: unknown): string | null {
  if (typeof u !== "string" || !u.trim()) return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : null;
  } catch {
    return null;
  }
}

export type ProtectionRow = { key: string; label: string; url: string | null };

// Only entries the API returns with supported === true. url is null when missing/invalid.
export function buildProtectionRows(profile: any): ProtectionRow[] {
  const raw = profile?.protections;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const known = new Map(KNOWN_PROTECTIONS);
  const keys = [...KNOWN_PROTECTIONS.map(([k]) => k), ...Object.keys(raw).filter((k) => !known.has(k))];
  return keys
    .filter((k) => raw[k] && typeof raw[k] === "object" && raw[k].supported === true)
    .map((k) => ({ key: k, label: known.get(k) ?? prettyKey(k), url: safeReportUrl(raw[k].url) }));
}
