"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/hooks/useWallet";
import WalletSelector from "@/components/WalletSelector";
import NetworkSwitchModal from "@/components/NetworkSwitchModal";

type TokenInfo = {
  address: string;
  symbol: string;
  name: string;
};

type QuoteData = {
  quoteId: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  priceImpactPercent?: number | string;
  executionMode: string;
  rfq?: {
    vendor: string;
    orderId: string;
    typedDataToSign: Record<string, any>;
  };
};

type SwapData = {
  executionMode: string;
  tx?: {
    from: string;
    to: string;
    data: string;
    value?: string;
    gas?: string;
  };
  rfq?: {
    vendor: string;
    orderId: string;
  };
};

type ApprovalData = {
  tokenContractAddress: string;
  spender: string;
  calldata: string;
  approveAmount: string;
  gasLimit?: string;
};

type TransactionStatus = {
  status: string; // pending, confirmed, failed
  transactionHash?: string;
  orderId?: string;
};

const redactSensitiveSwapResponse = (payload: any) => {
  if (!payload || typeof payload !== "object") return payload;

  const redacted = JSON.parse(JSON.stringify(payload));

  if (redacted?.rfq?.typedDataToSign) {
    delete redacted.rfq.typedDataToSign;
  }

  return redacted;
};

export default function TradeButton({ token }: { token: TokenInfo }) {
  const {
    provider,
    address,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    isInitializing,
    error,
    connect,
    switchToBscMainnet,
    signTypedData,
    signTransaction,
    waitForTransaction,
    readAllowance,
  } = useWallet();

  // State variables
  const [usdtAmount, setUsdtAmount] = useState("10"); // Default 10 USDT
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [swapData, setSwapData] = useState<SwapData | null>(null);
  const [typedDataToSign, setTypedDataToSign] = useState<any>(null);
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Ref to store the latest quote ID for polling
  const quoteIdRef = useRef<string | null>(null);

  // Fetch quote when manually requested (not automatic)
  const fetchQuote = async () => {
    if (!isConnected || !provider || !token.address || !usdtAmount) {
      setQuoteError("Please connect wallet and enter USDT amount");
      return;
    }

    if (!isCorrectNetwork) {
      setQuoteError("Switch to Binance Smart Chain Mainnet to continue.");
      return;
    }

    setIsLoading(true);
    setQuoteError(null);
    setQuoteData(null);
    setSwapData(null);
    setTypedDataToSign(null);
    setUserSignature(null);
    setApprovalData(null);
    setTransactionStatus(null);
    setSubmitError(null);
    setApprovalError(null);

    // Clear any existing poll interval
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }

    try {
      // Convert USDT amount to wei (18 decimals)
      const amountInWei = (parseFloat(usdtAmount) * 10 ** 18).toString(10);

      // Validate amount
      if (parseFloat(usdtAmount) <= 0) {
        throw new Error("USDT amount must be greater than 0");
      }

      const quoteResponse = await fetch(`/api/quote?toToken=${token.address}&amount=${amountInWei}&userWalletAddress=${address}`);
      const quoteResult = await quoteResponse.json();

      if (quoteResult.error) {
        throw new Error(quoteResult.error);
      }
      if (!quoteResult?.quoteId && !quoteResult?.data?.quoteId) {
        throw new Error("Quote failed — no quoteId returned. Check API key and clock sync.");
      }

      // quoteId may be at top level or nested under .data depending on API route
      const rawQuoteId: string = quoteResult?.quoteId
        ?? quoteResult?.data?.quoteId
        ?? "";
      const cleanQuoteId = String(rawQuoteId).replace(/-/g, "").toLowerCase();
      setQuoteData({ ...quoteResult, quoteId: cleanQuoteId } as QuoteData);
      quoteIdRef.current = cleanQuoteId;

      // Get swap details
      const swapResponse = await fetch(`/api/swap?toToken=${token.address}&amount=${amountInWei}&userWalletAddress=${address}&quoteId=${encodeURIComponent(cleanQuoteId)}`);
      const rawSwapText = await swapResponse.clone().text();
      const rawSwapObject = rawSwapText ? JSON.parse(rawSwapText) : null;
      const swapResult = rawSwapObject?.data ?? rawSwapObject;

      console.log("===== SWAP TX FORENSIC START =====");
      console.log("[SwapForensics] usdtAmount", usdtAmount);
      console.log("[SwapForensics] amountInWei", amountInWei);
      console.log("[SwapForensics] quoteId", cleanQuoteId);
      console.log("[SwapForensics] executionMode", swapResult?.executionMode ?? null);
      console.log("[SwapForensics] raw /api/swap response before transformation", redactSensitiveSwapResponse(rawSwapObject));
      console.log("[SwapForensics] exact object returned by /api/swap before transformation", redactSensitiveSwapResponse(rawSwapObject));
      console.log("[SwapForensics] unwrapped payload used by app", redactSensitiveSwapResponse(swapResult));
      console.log("===== SWAP TX FORENSIC END =====");

      if (swapResult?.error) {
        throw new Error(swapResult.error);
      }

      setSwapData(swapResult);

      if (swapResult?.executionMode === "SWAP") {
        const vendor = swapResult?.routerResult?.vendorName ?? swapResult?.vendorName;
        await checkApproval(amountInWei, vendor);
      }

      // If this is an RFQ, extract the typed data for signing
      if (swapResult?.executionMode === "RFQ" && swapResult.rfq && swapResult.rfq.typedDataToSign) {
        setTypedDataToSign(swapResult.rfq.typedDataToSign);
      } else {
        setTypedDataToSign(null);
      }
    } catch (err: any) {
      setQuoteError(err.message || "Failed to fetch quote");
      console.error("Trade error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle USDT amount change
  const handleUsdtAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsdtAmount(e.target.value);
    setQuoteError(null);
  };

  // Sign the typed data
  const handleSign = async () => {
    if (!typedDataToSign || !provider) return;

    setSubmitError(null);
    try {
      const signature = await signTypedData(typedDataToSign);
      if (signature) {
        setUserSignature(signature);
      } else {
        setSubmitError("Failed to sign typed data");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to sign typed data");
    }
  };

  // Check if approval is needed and get approval transaction data
  const checkApproval = async (amount?: string, vendor?: string) => {
    if (!isConnected || !provider || !token.address || !usdtAmount) return;

    setIsApproving(true);
    setApprovalError(null);
    setApprovalData(null);

    try {
      // Convert USDT amount to wei (18 decimals)
      const amountInWei = amount ?? (parseFloat(usdtAmount) * 10 ** 18).toString(10);
      const params = new URLSearchParams({
        tokenContractAddress: "0x55d398326f99059ff775485246999027b3197955",
        approveAmount: amountInWei,
        userWalletAddress: address ?? "",
      });
      if (vendor) params.set("vendor", vendor);

      const approveResponse = await fetch(`/api/approve-transaction?${params}`);
      const approveResult = await approveResponse.json();

      if (approveResult.error) {
        throw new Error(approveResult.error);
      }

      const approvalTransaction = Array.isArray(approveResult.data)
        ? approveResult.data[0]
        : approveResult.data;
      if (
        approvalTransaction?.dexContractAddress &&
        approvalTransaction?.data
      ) {
        const tokenContractAddress = "0x55d398326f99059ff775485246999027b3197955";
        const currentAllowance = await readAllowance(
          tokenContractAddress,
          approvalTransaction.dexContractAddress
        );
        if (currentAllowance !== null && currentAllowance >= BigInt(amountInWei)) {
          setApprovalData(null);
          return;
        }

        setApprovalData({
          tokenContractAddress,
          spender: approvalTransaction.dexContractAddress,
          calldata: approvalTransaction.data,
          approveAmount: amountInWei,
          gasLimit: approvalTransaction.gasLimit,
        });
      } else {
        throw new Error("Binance did not return a valid USDT approval transaction");
      }
    } catch (err: any) {
      setApprovalError(err.message || "Failed to get approval transaction");
      console.error("Approval error:", err);
    } finally {
      setIsApproving(false);
    }
  };

  // Sign and submit approval transaction
  const handleApprove = async () => {
    if (!approvalData || !provider) return;

    setIsApproving(true);
    setApprovalError(null);
    try {
      // Create a transaction request for the approval
      const transactionRequest = {
        to: approvalData.tokenContractAddress,
        data: approvalData.calldata,
        gas: approvalData.gasLimit,
      };

      const transactionHash = await signTransaction(transactionRequest);
      if (!transactionHash) {
        throw new Error("Wallet did not submit the approval transaction");
      }

      const allowanceConfirmed = (async () => {
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const currentAllowance = await readAllowance(
            approvalData.tokenContractAddress,
            approvalData.spender
          );
          if (
            currentAllowance !== null &&
            currentAllowance >= BigInt(approvalData.approveAmount)
          ) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
        return false;
      })();
      const approvalConfirmed = await Promise.race([
        waitForTransaction(transactionHash).then((receiptStatus) => {
          if (receiptStatus === "confirmed") return true;
          if (receiptStatus === "failed") return false;
          return allowanceConfirmed;
        }),
        allowanceConfirmed,
      ]);

      if (approvalConfirmed) {
        setApprovalData(null);
      } else {
        setApprovalError("Could not confirm approval. Check the transaction on BscScan, then click Get Quote to refresh allowance status.");
      }
    } catch (err: any) {
      setApprovalError(err.message || "Failed to submit approval transaction");
    } finally {
      setIsApproving(false);
    }
  };

  // Submit the signed order
  const handleSubmitOrder = async () => {
    if (!quoteData || !swapData || !provider || !address) return;

    if (swapData.executionMode === "SWAP") {
      const tx = swapData.tx;
      if (!tx?.from || !tx.to || !tx.data) {
        setSubmitError("Swap response is missing its transaction details");
        return;
      }
      if (tx.from.toLowerCase() !== address.toLowerCase()) {
        setSubmitError("Swap transaction wallet does not match the connected wallet");
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      setTransactionStatus(null);

      try {
        const transactionHash = await signTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gas: tx.gas,
        });

        if (!transactionHash) {
          throw new Error("Wallet did not submit the swap transaction");
        }

        setTransactionStatus({
          status: "pending",
          transactionHash,
        });
        void waitForTransaction(transactionHash).then((receiptStatus) => {
          setTransactionStatus((current) =>
            current?.transactionHash === transactionHash
              ? { ...current, status: receiptStatus }
              : current
          );
        });
      } catch (err: any) {
        setSubmitError(err.message || "Failed to submit swap transaction");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (swapData.executionMode !== "RFQ" || !userSignature) {
      setSubmitError("This swap execution mode is not supported");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setTransactionStatus(null);

    try {
      // Generate a UUID v4 for requestId (simplified)
      const requestId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      // Extract required data from swap response
      const vendor = swapData.rfq?.vendor;
      const quoteId = quoteData.quoteId;

      if (!vendor || !quoteId) {
        throw new Error("Missing required data for order submission");
      }

      const submitResponse = await fetch(`/api/order/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          userSignature,
          vendor,
          quoteId
        }),
      });

      const submitResult = await submitResponse.json();

      if (submitResult.error) {
        throw new Error(submitResult.error);
      }

      // Set initial transaction status
      setTransactionStatus({
        status: "pending",
        orderId: submitResult.orderId || quoteId
      });

      // Start polling for transaction status
      startPollingTransactionStatus(submitResult.orderId || quoteId);

    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit order");
      console.error("Order submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll for transaction status
  const startPollingTransactionStatus = (orderId: string) => {
    // Clear any existing interval
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    // Set up polling every 5 seconds
    const interval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/order/${orderId}`);
        const statusResult = await statusResponse.json();

        if (statusResult.error) {
          throw new Error(statusResult.error);
        }

        // Update transaction status based on response
        // This would need to be adjusted based on actual Binance API response format
        setTransactionStatus(prev => ({
          ...prev!,
          status: statusResult.status || "pending",
          transactionHash: statusResult.transactionHash,
          // Add other relevant fields as needed
        }));

        // Stop polling if transaction is confirmed or failed
        if (statusResult.status === "confirmed" || statusResult.status === "failed") {
          clearInterval(interval);
          setPollInterval(null);
        }
      } catch (err) {
        console.error("Error polling transaction status:", err);
        // Continue polling despite errors
      }
    }, 5000);

    setPollInterval(interval);
  };

  // Clean up poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  // Reset state when token or address changes
  useEffect(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setQuoteData(null);
    setSwapData(null);
    setTypedDataToSign(null);
    setUserSignature(null);
    setApprovalData(null);
    setTransactionStatus(null);
    setSubmitError(null);
    setApprovalError(null);
    setQuoteError(null);
  }, [token.address, address]);

  // Whether THIS quote's execution mode requires an EIP-712 signature at
  // all. RFQ quotes do (typedDataToSign comes back from /api/swap); a
  // direct-execution quote does not, and never will have typedDataToSign
  // set. The old code required !!userSignature unconditionally, which made
  // the button impossible to enable whenever typedDataToSign was still
  // null - i.e. exactly the case the button is rendered for.
  const requiresTypedDataSignature = !!typedDataToSign;

  const canExecute =
    isConnected &&
    isCorrectNetwork &&
    !!address &&
    !!provider &&
    !!quoteData &&
    !!swapData &&
    !isLoading &&
    !isSubmitting &&
    !isApproving &&
    !approvalError &&
    (!requiresTypedDataSignature || !!userSignature);

  if (process.env.NODE_ENV !== "production") {
    // Dev-only visibility into the gating logic. No signatures or other
    // sensitive wallet data are logged - only booleans/flags.
    // eslint-disable-next-line no-console
    console.debug("[TradeButton] canExecute inputs", {
      hasAddress: !!address,
      hasProvider: !!provider,
      hasQuote: !!quoteData,
      hasSwapData: !!swapData,
      hasTypedData: !!typedDataToSign,
      hasUserSignature: !!userSignature,
      isLoading,
      isSubmitting,
      isApproving,
      requiresTypedDataSignature,
      canExecute,
    });
  }

  // Show connection status and errors.
  // isInitializing covers the brief silent "do we already have an
  // authorized wallet?" check on first mount - it must never be confused
  // with isConnecting (which only reflects an explicit user-clicked
  // Connect in progress), or refreshing the page would flash the
  // WalletSelector / "Connecting..." UI before settling.
  if (isInitializing) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-xs text-[#64748b]">Checking wallet connection...</p>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div className="animate-spin w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-xs text-[#64748b]">Connecting to wallet...</p>
      </div>
    );
  }

  // If there's an error and we're not connecting, show wallet selector instead of just error
  if (error && !isConnecting) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <WalletSelector
          isConnecting={isConnecting}
          error={error}
          onConnect={connect}
        />
      </div>
    );
  }

  // If not connected and no error, show wallet selector to help user connect
  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <WalletSelector
          isConnecting={isConnecting}
          error={error}
          onConnect={connect}
        />
      </div>
    );
  }

  const handleNetworkSwitch = async () => {
    setIsSwitchingNetwork(true);
    try {
      await switchToBscMainnet();
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  return (
    <div style={{ border: "1px solid #374151", borderRadius: "0.5rem", padding: "1rem", margin: "0.5rem 0" }}>
      <NetworkSwitchModal
        open={isConnected && !isCorrectNetwork}
        isSwitching={isSwitchingNetwork}
        onSwitch={handleNetworkSwitch}
        onClose={() => undefined}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.125rem" }}>Trade {token.symbol}</h3>
        <span style={{ fontSize: "0.875rem", color: isConnected ? "#10b981" : "#ef4444" }}>
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
        Wallet: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
      </div>
      {!isCorrectNetwork && (
        <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", backgroundColor: "#7f1d1d", color: "#fecaca", fontSize: "0.75rem", fontWeight: 700 }}>
          Unsupported network detected. Switch to Binance Smart Chain Mainnet before trading.
        </div>
      )}

      {/* USDT Amount Input */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
          USDT Amount
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="number"
            value={usdtAmount}
            onChange={handleUsdtAmountChange}
            placeholder="Enter USDT amount"
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "0.25rem",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "white",
              fontSize: "0.875rem"
            }}
          />
          <button
            onClick={fetchQuote}
            disabled={isLoading || !isConnected || !usdtAmount || parseFloat(usdtAmount) <= 0}
            style={{
              backgroundColor: isLoading || !isConnected || !usdtAmount || parseFloat(usdtAmount) <= 0 ? "#374151" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              cursor: (isLoading || !isConnected || !usdtAmount || parseFloat(usdtAmount) <= 0) ? "not-allowed" : "pointer"
            }}
          >
            {isLoading ? "Fetching..." : "Get Quote"}
          </button>
        </div>
        {quoteError && (
          <div style={{
            backgroundColor: "#7f1d1d",
            color: "#fecaca",
            borderRadius: "0.25rem",
            padding: "0.5rem",
            fontSize: "0.75rem",
            marginTop: "0.5rem"
          }}>
            {quoteError}
          </div>
        )}
      </div>

      {/* Quote Details */}
      {quoteData && (
        <div style={{ backgroundColor: "#1f2937", borderRadius: "0.25rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Quote Details</div>
          <div style={{ fontSize: "0.875rem", fontFamily: "monospace", marginBottom: "0.25rem" }}>
            Quote ID: {quoteData.quoteId}
          </div>
          <div style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
            {quoteData.fromTokenAmount} USDT → {quoteData.toTokenAmount} {token.symbol}
          </div>
          {quoteData.priceImpactPercent !== undefined && (
            <div style={{ fontSize: "0.75rem", color: "#fbbf24", marginTop: "0.25rem" }}>
              Price Impact: {quoteData.priceImpactPercent}%
            </div>
          )}
          {swapData && swapData.executionMode && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Execution Mode: {swapData.executionMode}
            </div>
          )}
          {swapData && swapData.rfq && swapData.rfq.vendor && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.125rem" }}>
              Vendor: {swapData.rfq.vendor}
            </div>
          )}
        </div>
      )}

      {/* Approval Section (if needed) */}
      {approvalData && !isApproving && (
        <div style={{ backgroundColor: "#1f2937", borderRadius: "0.25rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Approval Required</div>
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
            To trade {token.symbol}, you need to approve the USDT token for spending by the trading contract.
          </p>
          <button
            onClick={handleApprove}
            disabled={isApproving}
            style={{
              backgroundColor: isApproving ? "#374151" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              cursor: isApproving ? "not-allowed" : "pointer"
            }}
          >
            {isApproving ? "Approving..." : "Approve USDT"}
          </button>
          {approvalError && (
            <div style={{
              backgroundColor: "#7f1d1d",
              color: "#fecaca",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              {approvalError}
            </div>
          )}
        </div>
      )}

      {/* Approval in progress */}
      {isApproving && (
        <div style={{
          backgroundColor: "#1f2937",
          borderRadius: "0.25rem",
          padding: "0.75rem",
          marginBottom: "0.5rem",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>Approving...</div>
        </div>
      )}

      {/* Typed Data to Sign */}
      {typedDataToSign && !approvalData && (
        <div style={{ backgroundColor: "#1f2937", borderRadius: "0.25rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>EIP-712 Typed Data to Sign</div>
          <div style={{ fontSize: "0.75rem", color: "#d1d5db", fontFamily: "monospace", overflowX: "auto", maxHeight: "150px" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(typedDataToSign, null, 2)}
            </pre>
          </div>
          <button
            onClick={handleSign}
            disabled={isLoading || !!userSignature}
            style={{
              backgroundColor: !userSignature ? "#3b82f6" : "#374151",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              cursor: !userSignature ? "pointer" : "not-allowed"
            }}
          >
            {!userSignature ? "Sign Typed Data" : "Signature Obtained"}
          </button>
          {userSignature && (
            <div style={{
              backgroundColor: "#064e3b",
              color: "#dcfce7",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              Signature obtained: {userSignature.substring(0, 66)}...
            </div>
          )}
          {submitError && (
            <div style={{
              backgroundColor: "#7f1d1d",
              color: "#fecaca",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Submit Order Button.
          Rendered whenever we have a quote to act on, regardless of
          whether this quote requires typed-data signing - the typed-data
          panel above (when present) and canExecute together gate whether
          it's actually clickable. Previously this required
          !typedDataToSign, which meant the button was rendered ONLY in
          the case where canExecute's `!!typedDataToSign` term made it
          permanently false - i.e. the button could be visible but could
          never become enabled. */}
      {!approvalData && quoteData && swapData && (
        <div style={{ marginTop: "1rem" }}>
          <button
            onClick={handleSubmitOrder}
            disabled={!canExecute || isSubmitting}
            style={{
              width: "100%",
              backgroundColor: canExecute && !isSubmitting ? "#10b981" : "#374151",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              padding: "0.75rem",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: canExecute && !isSubmitting ? "pointer" : "not-allowed"
            }}
          >
            {isSubmitting ? "Submitting..." : "Sign & Execute Trade"}
          </button>
          {submitError && (
            <div style={{
              backgroundColor: "#7f1d1d",
              color: "#fecaca",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Transaction Status */}
      {transactionStatus && (
        <div style={{ backgroundColor: "#1f2937", borderRadius: "0.25rem", padding: "0.75rem", marginTop: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Transaction Status</div>
          <div style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
            Status: {transactionStatus.status}
          </div>
          {transactionStatus.orderId && (
            <div style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
              Order ID: {transactionStatus.orderId}
            </div>
          )}
          {transactionStatus.transactionHash && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem"
            }}>
              <div style={{ fontSize: "0.875rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                Transaction Hash: {transactionStatus.transactionHash}
              </div>
              <a
                href={`https://bscscan.com/tx/${transactionStatus.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.75rem",
                  color: "#3b82f6",
                  textDecoration: "underline"
                }}
              >
                View on BSCScan
              </a>
            </div>
          )}
          {transactionStatus.status === "confirmed" && (
            <div style={{
              backgroundColor: "#064e3b",
              color: "#dcfce7",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              Transaction confirmed successfully!
            </div>
          )}
          {transactionStatus.status === "failed" && (
            <div style={{
              backgroundColor: "#7f1d1d",
              color: "#fecaca",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              Transaction failed.
            </div>
          )}
          {transactionStatus.status === "unverified" && (
            <div style={{
              backgroundColor: "#78350f",
              color: "#fef3c7",
              borderRadius: "0.25rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
              marginTop: "0.5rem"
            }}>
              Confirmation could not be verified yet. Check BscScan before retrying.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
