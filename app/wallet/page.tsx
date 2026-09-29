"use client";

import Link from "next/link";
import WalletSelector from "@/components/WalletSelector";
import { useWallet } from "@/hooks/useWallet";
import { useEffect, useState } from "react";
import GlobalNav from "@/components/GlobalNav";

export const dynamic = "force-dynamic";

export default function WalletPage() {
  const {
    provider,
    address,
    isConnected,
    isConnecting,
    isInitializing,
    error,
    connect,
    disconnect
  } = useWallet();

  return (
    <main className="min-h-screen bg-[#07070f] text-white pb-10">
      <nav className="border-b border-[#1b1b35] bg-[#0e0e1c] px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="text-[#64748b] text-xl">←</Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#f0b90b] flex items-center justify-center font-black text-black text-sm">W</div>
          <span className="font-bold text-lg tracking-wide">WOLV Stock Terminal</span>
        </div>
      </nav>

      <div className="px-4 sm:px-6 pt-6">
        {isInitializing && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
            <p className="mt-2 text-xs text-[#64748b]">Checking wallet connection...</p>
          </div>
        )}

        {!isInitializing && isConnecting && (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full" />
            <p className="mt-2 text-xs text-[#64748b]">Connecting...</p>
          </div>
        )}

        {!isInitializing && !isConnected && !isConnecting && (
          <>
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-xs font-black">
                🔌
              </div>
              <p className="mt-2 text-xs text-[#64748b]">Wallet not connected</p>
            </div>
            <WalletSelector
              isConnecting={isConnecting}
              error={error}
              onConnect={connect}
            />
          </>
        )}

        {!isInitializing && isConnected && !isConnecting && (
          <div className="space-y-6">
            <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-[#64748b] font-medium">Wallet Address</div>
                <button
                  onClick={() => navigator.clipboard.writeText(address || "")}
                  className="text-xs text-[#f0b90b] hover:text-[#f0b90b]/80"
                >
                  Copy
                </button>
              </div>
              <div className="font-mono text-xs text-[#f0b90b]">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}
              </div>
            </div>

            <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-6">
              <div className="text-xs text-[#64748b] font-medium mb-2">Network Status</div>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                <span className="text-xs text-[#10b981]">BSC Mainnet (Chain ID: 56)</span>
              </div>
            </div>

            <div className="bg-[#0e0e1c] border border-[#1b1b35] rounded-xl p-6">
              <div className="text-xs text-[#64748b] font-medium mb-2">Portfolio</div>
              <div className="text-xs text-[#64748b]">
                Wallet-connected portfolio tracking coming soon.
                Use the Trade page to buy and sell tokenized assets.
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={disconnect}
                className="w-full max-w-xs bg-[#dc2626] hover:bg-[#dc2626]/90 text-white font-bold py-3 px-6 rounded-xl"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>

      <GlobalNav />
    </main>
  );
}
