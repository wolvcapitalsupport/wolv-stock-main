import { http, createConfig } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// Same env var name the old lib/wallet.ts used - no deployment config change needed.
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_PROJECT_ID;

if (!walletConnectProjectId) {
  // Non-fatal: the app still works with injected wallets (MetaMask, Trust
  // Wallet, etc.) via EIP-1193 without WalletConnect configured. This
  // mirrors the previous lib/wallet.ts behavior, which logged an error and
  // returned null from the WalletConnect path rather than crashing.
  console.warn(
    "NEXT_PUBLIC_WALLET_PROJECT_ID is not set - WalletConnect will be unavailable; injected wallets still work."
  );
}

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: "WOLV Stock Terminal",
              description: "WOLV Stock Terminal - Trade tokenized assets",
              url: "https://wolv-stock.vercel.app/",
              icons: ["https://wolv-stock.vercel.app/logo.png"],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [bsc.id]: http("https://bsc-dataseed.binance.org/"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
