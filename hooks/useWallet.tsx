"use client";

import { useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSendTransaction,
  useSignTypedData,
  useWalletClient,
} from "wagmi";

interface TxRequest {
  to: string;
  data: string;
  value?: bigint | string;
  gas?: bigint | string;
}

interface WalletHookValue {
  /** Kept as `provider` for source-compat with existing call sites, which
   *  only ever used it as a truthy "do we have a signer ready" gate. Its
   *  real type is now a viem WalletClient (from wagmi), not an
   *  ethers.BrowserProvider. */
  provider: ReturnType<typeof useWalletClient>["data"] | null;
  address: string | null;
  isConnected: boolean;
  /** True only while an explicit, user-initiated connect() is in flight. */
  isConnecting: boolean;
  /** True only during wagmi's automatic reconnect-from-storage on mount. */
  isInitializing: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTypedData: (typedData: Record<string, any>) => Promise<string | null>;
  signTransaction: (transaction: TxRequest) => Promise<string | null>;
  waitForTransaction: (hash: string) => Promise<boolean>;
}

/**
 * Thin wrapper around wagmi's hooks.
 *
 * All connection state, silent reconnect-on-mount, accountsChanged /
 * chainChanged / disconnect handling, and single-source-of-truth state
 * sharing across components now live inside wagmi itself (via the single
 * <WagmiProvider> in app/providers.tsx, see lib/wagmi.ts for the config).
 * This file no longer contains ANY eth_requestAccounts / eth_accounts
 * calls, listener registration, or localStorage bookkeeping - wagmi's
 * connectors own all of that, which is what "removing the custom wallet
 * connection handler" means here. The custom implementation this replaces
 * (hand-rolled useState/useEffect + lib/wallet.ts) is gone.
 *
 * The return shape is intentionally identical to the previous
 * hand-rolled version so TradeButton.tsx, WalletSelector.tsx, and
 * app/wallet/page.tsx did not need to change.
 */
export function useWallet(): WalletHookValue {
  const { address, isConnected, isReconnecting } = useAccount();
  const {
    connectors,
    connectAsync,
    error: connectError,
    isPending: isConnectPending,
  } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();

  // Prefer an already-injected wallet (MetaMask, Trust Wallet, etc.);
  // otherwise fall back to WalletConnect. Mirrors the old lib/wallet.ts
  // fallback order, but the actual eth_requestAccounts call, BSC chain
  // enforcement (chainId: 56 below), and QR-modal flow are all handled by
  // wagmi's connectors, not by hand-rolled window.ethereum calls.
  const connect = useCallback(async () => {
    const injectedConnector = connectors.find((c) => c.type === "injected");
    const walletConnectConnector = connectors.find(
      (c) => c.type === "walletConnect"
    );
    const target = injectedConnector ?? walletConnectConnector ?? connectors[0];
    if (!target) return;
    try {
      await connectAsync({ connector: target, chainId: 56 });
    } catch (err) {
      // connectAsync already surfaces the error via useConnect()'s `error`,
      // which we expose below - nothing else to do here.
    }
  }, [connectors, connectAsync]);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  const signTypedData = useCallback(
    async (typedData: Record<string, any>): Promise<string | null> => {
      if (!address) return null;
      try {
        // EIP-712 typed data needs an explicit primaryType for viem/wagmi's
        // signTypedData, whereas ethers' signer.signTypedData() inferred it.
        // Use it if the API already included one, else derive it as the
        // single non-EIP712Domain key of `types`.
        const primaryType: string =
          typedData.primaryType ??
          Object.keys(typedData.types ?? {}).find(
            (key) => key !== "EIP712Domain"
          );

        return await signTypedDataAsync({
          domain: typedData.domain,
          types: typedData.types,
          primaryType: primaryType as any,
          message: typedData.message,
        });
      } catch (err) {
        console.error("Failed to sign typed data:", err);
        return null;
      }
    },
    [address, signTypedDataAsync]
  );

  // NOTE - real behavior change vs. the old implementation, flagged
  // explicitly: the previous lib/wallet.ts signTransaction() only SIGNED a
  // transaction (signer.signTransaction) and never broadcast it - the old
  // handleApprove() in TradeButton.tsx just logged the signed tx and
  // pretended approval succeeded. wagmi/viem doesn't expose an equivalent
  // "sign only, don't send" primitive for a plain transaction the way
  // ethers did, so this now actually sends the transaction via wagmi's
  // useSendTransaction and returns the resulting tx hash instead of a
  // signed raw tx string. Call sites that only checked truthiness of the
  // return value are unaffected; anything that assumed the tx was NOT yet
  // broadcast needs to be revisited.
  const signTransaction = useCallback(
    async (transaction: TxRequest): Promise<string | null> => {
      if (!address) return null;

      const sendRequest = {
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value:
          transaction.value !== undefined
            ? BigInt(transaction.value)
            : undefined,
        gas:
          transaction.gas !== undefined
            ? BigInt(transaction.gas)
            : undefined,
      };

      console.log("===== SWAP TX FORENSIC START =====");
      console.log("[SwapForensics] from account selected by wagmi", address);
      console.log("[SwapForensics] exact object passed into sendTransactionAsync", sendRequest);
      console.log("===== SWAP TX FORENSIC END =====");

      try {
        const hash = await sendTransactionAsync(sendRequest);
        return hash;
      } catch (err) {
        console.error("Failed to send transaction:", err);
        return null;
      }
    },
    [address, sendTransactionAsync]
  );

  const waitForTransaction = useCallback(
    async (hash: string): Promise<boolean> => {
      if (!publicClient) return false;
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: hash as `0x${string}`,
        });
        return receipt.status === "success";
      } catch (err) {
        console.error("Failed waiting for transaction receipt:", err);
        return false;
      }
    },
    [publicClient]
  );

  return {
    provider: walletClient ?? null,
    address: address ?? null,
    isConnected,
    isConnecting: isConnectPending,
    isInitializing: isReconnecting,
    error: connectError?.message ?? null,
    connect,
    disconnect,
    signTypedData,
    signTransaction,
    waitForTransaction,
  };
}
