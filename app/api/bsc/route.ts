import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";
const USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955";
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(BSC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BSC RPC returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || "BSC RPC request failed");
  }

  return payload.result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "allowance") {
      const { tokenAddress, owner, spender } = body;
      if (typeof tokenAddress !== "string" || tokenAddress.toLowerCase() !== USDT_ADDRESS.toLowerCase()) {
        return NextResponse.json({ error: "Unsupported token address" }, { status: 400 });
      }
      if (typeof owner !== "string" || typeof spender !== "string" || !ADDRESS_PATTERN.test(owner) || !ADDRESS_PATTERN.test(spender)) {
        return NextResponse.json({ error: "Invalid owner or spender address" }, { status: 400 });
      }

      const data = `0xdd62ed3e${owner.slice(2).toLowerCase().padStart(64, "0")}${spender.slice(2).toLowerCase().padStart(64, "0")}`;
      const result = await rpc("eth_call", [{ to: USDT_ADDRESS, data }, "latest"]);
      if (typeof result !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(result)) {
        throw new Error("BSC RPC returned an invalid allowance result");
      }

      return NextResponse.json({ allowance: BigInt(result).toString() });
    }

    if (body.action === "receipt") {
      const { hash } = body;
      if (!HASH_PATTERN.test(hash)) {
        return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
      }

      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt === null) {
        return NextResponse.json({ status: "pending" });
      }
      if (!receipt || (receipt.status !== "0x0" && receipt.status !== "0x1")) {
        throw new Error("BSC RPC returned an invalid transaction receipt");
      }

      return NextResponse.json({ status: receipt.status === "0x1" ? "success" : "reverted" });
    }

    return NextResponse.json({ error: "Unsupported BSC read action" }, { status: 400 });
  } catch (error) {
    console.error("BSC read API error:", error);
    return NextResponse.json({ error: "Failed to read BNB Smart Chain state" }, { status: 502 });
  }
}
