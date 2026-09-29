type NetworkSwitchModalProps = {
  open: boolean;
  isSwitching: boolean;
  onSwitch: () => Promise<void> | void;
  onClose?: () => void;
};

export default function NetworkSwitchModal({
  open,
  isSwitching,
  onSwitch,
  onClose,
}: NetworkSwitchModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02060d]/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#f0b90b]/40 bg-[#0e0e1c] p-6 shadow-2xl shadow-[#f0b90b]/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0b90b]/15 text-2xl">⚠️</div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-[#64748b] hover:text-white"
              aria-label="Close warning"
            >
              ✕
            </button>
          )}
        </div>

        <h3 className="text-xl font-black text-white">Unsupported Network</h3>
        <p className="mt-3 text-sm leading-6 text-[#cbd5e1]">
          Your wallet is connected to a network that cannot trade WOLV tokenized equities. This terminal requires Binance Smart Chain Mainnet to stay compliant with the Spot Trading Only hackathon rule.
        </p>

        <div className="mt-4 rounded-xl border border-[#f0b90b]/30 bg-[#f0b90b]/5 p-3 text-sm text-[#f0b90b] font-bold">
          Switch to Binance Smart Chain Mainnet
        </div>

        <button
          onClick={onSwitch}
          disabled={isSwitching}
          className="mt-5 w-full rounded-xl bg-[#f0b90b] px-4 py-3 text-sm font-black text-black transition hover:bg-[#f7ce57] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSwitching ? "Switching…" : "Switch to Binance Smart Chain Mainnet"}
        </button>

        <p className="mt-3 text-center text-[11px] uppercase tracking-[0.18em] text-[#64748b]">
          Required before WOLV Terminal interaction
        </p>
      </div>
    </div>
  );
}
