import Link from "next/link";
import { notFound } from "next/navigation";
import { getRWATokenList } from "@/lib/binance";
import TradeButton from "@/components/TradeButton";
import GlobalNav from "@/components/GlobalNav";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function TradePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const tokens = await getRWATokenList();
  const token = tokens?.data?.find((t: any) => t.tokenContractAddress.toLowerCase() === address.toLowerCase());

  if (!token) {
    return (
      <main className="min-h-screen bg-[#07070f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-[#64748b]">Asset not found. Please check the asset address or return to the trade page to select an asset.</p>
          <Link href="/trade" className="text-[#f0b90b] text-sm mt-4 block">← Back to Trade Page</Link>
        </div>
      </main>
    );
  }

  const tokenInfo = {
    address: token.tokenContractAddress,
    symbol: token.underlyingTicker || "UNKNOWN",
    name: token.underlyingName || token.tokenName || "Unknown Token",
  };

  return (
    <main className="min-h-screen bg-[#07070f] text-white">
      <nav className="border-b border-[#1b1b35] bg-[#0e0e1c] px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <BackButton fallbackHref="/trade" className="text-[#64748b] text-xl" />
        {token.tokenLogoUrl && (
          <img
            src={token.tokenLogoUrl}
            className="w-8 h-8 rounded-full"
            alt={token.underlyingTicker}
          />
        )}
        <div className="min-w-0">
          <div className="font-black text-lg">{tokenInfo.symbol}</div>
          <div className="text-xs text-[#64748b] truncate">
            {tokenInfo.name}
          </div>
        </div>
      </nav>

      <div className="px-4 sm:px-6 pt-6">
        <TradeButton token={tokenInfo} />
      </div>

      <GlobalNav />
    </main>
  );
}