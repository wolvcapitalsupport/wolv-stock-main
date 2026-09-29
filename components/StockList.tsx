"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { TAG_LABELS, knownTags } from "@/lib/rwaData";

type T = {
  tokenContractAddress: string;
  tokenLogoUrl?: string;
  underlyingTicker: string;
  underlyingName?: string;
  tokenName?: string;
  platformId: string;
  tags?: string[] | null;
};

const TAG_STYLE: Record<string, string> = {
  alpha: "text-purple-300 border-purple-800/60 bg-purple-900/20",
  communityRecognized: "text-sky-300 border-sky-800/60 bg-sky-900/20",
  volumeSurge: "text-green-400 border-green-800/60 bg-green-900/20",
  volumePlunge: "text-red-400 border-red-800/60 bg-red-900/20",
};

function Logo({ url, tk }: { url?: string; tk: string }) {
  const [bad, setBad] = useState(false);
  if (!url || bad)
    return (
      <div className="w-9 h-9 rounded-full bg-[#1b1b35] shrink-0 flex items-center justify-center text-[10px] font-black text-[#f0b90b]">
        {tk.slice(0, 4)}
      </div>
    );
  return <img src={url} loading="lazy" onError={() => setBad(true)} className="w-9 h-9 rounded-full bg-[#1b1b35] shrink-0" alt={tk} />;
}

export default function StockList({ tokens, category }: { tokens: T[]; category?: string }) {
  const [q, setQ] = useState("");
  const [plat, setPlat] = useState("all");
  const [limit, setLimit] = useState(50);

  const platforms = useMemo(
    () => Array.from(new Set(tokens.map((t) => t.platformId))).sort(),
    [tokens]
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const starts = (t: T) => Number(t.underlyingTicker.toLowerCase().startsWith(s));
    return tokens
      .filter(
        (t) =>
          (plat === "all" || t.platformId === plat) &&
          (!s ||
            `${t.underlyingTicker} ${t.underlyingName ?? ""} ${t.tokenName ?? ""}`
              .toLowerCase()
              .includes(s))
      )
      .sort((a, b) => (s ? starts(b) - starts(a) : 0));
  }, [tokens, q, plat]);

  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-bold capitalize border transition-colors ${
      active
        ? "bg-[#f0b90b] text-black border-[#f0b90b]"
        : "bg-[#0e0e1c] text-[#94a3b8] border-[#1b1b35]"
    }`;

  return (
    <div className="px-4 sm:px-6 pb-10">
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setLimit(50); }}
        placeholder="Search ticker or company (e.g. NVDA)"
        className="w-full mb-3 bg-[#0e0e1c] border border-[#1b1b35] rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748b] outline-none focus:border-[#f0b90b]/50"
      />
      <div className="flex gap-2 mb-4 flex-wrap">
        <button className={chip(plat === "all")} onClick={() => { setPlat("all"); setLimit(50); }}>
          All
        </button>
        {platforms.map((p) => (
          <button key={p} className={chip(plat === p)} onClick={() => { setPlat(p); setLimit(50); }}>
            {p}
          </button>
        ))}
      </div>

      <div className="text-xs text-[#64748b] mb-3 uppercase tracking-wider font-bold">
        {rows.length} tokenized stock{rows.length === 1 ? "" : "s"}{category ? ` · ${category}` : ""}
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-[#64748b] py-8 text-center">No matches. Try a ticker like SPY, a company name, or another category.</div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {rows.slice(0, limit).map((t) => (
            <Link
              key={t.tokenContractAddress}
              href={`/stock/${t.tokenContractAddress}`}
              className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-4 flex items-center justify-between hover:border-[#f0b90b]/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Logo url={t.tokenLogoUrl} tk={t.underlyingTicker} />
                <div className="min-w-0">
                  <div className="font-bold text-sm">{t.underlyingTicker}</div>
                  <div className="text-xs text-[#64748b] truncate">
                    {t.underlyingName || t.tokenName?.replace(/\s*\(.*?\)\s*/g, "")}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 empty:hidden">
                    {knownTags(t.tags).map((tag) => (
                      <span key={tag} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TAG_STYLE[tag]}`}>
                        {TAG_LABELS[tag]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-xs text-[#64748b] capitalize">{t.platformId}</div>
                <div className="text-xs text-[#f0b90b] font-bold mt-0.5">BSC →</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {rows.length > limit && (
        <button
          onClick={() => setLimit(limit + 100)}
          className="mt-4 w-full py-3 rounded-xl border border-[#1b1b35] bg-[#0e0e1c] text-sm font-bold text-[#f0b90b]"
        >
          Show more ({rows.length - limit} left)
        </button>
      )}
    </div>
  );
}
