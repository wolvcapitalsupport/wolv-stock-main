interface WalletSelectorProps {
  isConnecting: boolean;
  error: string | null;
  onConnect: () => Promise<void>;
}

// NOTE: this component intentionally does NOT call useWallet() itself.
// It previously did, which meant it was creating a second, independent
// wallet-state instance alongside whatever parent already called
// useWallet() (before useWallet became a shared context). It only ever
// used the onConnect prop anyway, so the extra hook call was dead code
// that could still fire its own connect/listener effects.
export default function WalletSelector({
  isConnecting,
  error,
  onConnect
}: WalletSelectorProps) {
  return (
    <div className="text-center py-8">
      {!isConnecting && (
        <>
          <div className="w-12 h-12 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-xs font-black mb-4">
            🔌
          </div>
          <p className="mt-2 text-xs text-[#64748b] mb-6">
            No wallet detected. Please select a wallet to connect:
          </p>
          <div className="space-y-3">
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="w-full max-w-xs mx-auto bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-bold py-3 px-6 rounded-xl"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
            <div className="text-xs text-[#64748b] mt-4">
              <p className="mb-2">Supported wallets:</p>
              <div className="space-y-1 text-left max-w-xs mx-auto">
                <div>• MetaMask</div>
                <div>• Trust Wallet</div>
                <div>• WalletConnect</div>
                <div>• And other Ethereum-compatible wallets</div>
              </div>
            </div>
          </div>
        </>
      )}

      {isConnecting && (
        <>
          <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-xs text-[#64748b]">Connecting to wallet...</p>
        </>
      )}

      {error && !isConnecting && (
        <div className="mt-4">
          <div className="w-8 h-8 rounded-full bg-[#dc2626]/20 flex items-center justify-center text-xs font-black mx-auto mb-2">
            ❌
          </div>
          <p className="text-xs text-[#dc2626]">{error}</p>
          <button
            onClick={onConnect}
            className="mt-2 w-full max-w-xs mx-auto bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-black font-bold py-3 px-6 rounded-xl"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}