import { NextResponse } from "next/server";
import { getAggregatorSwap } from "@/lib/binance";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ [key: string]: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const toToken = searchParams.get("toToken");
    const amount = searchParams.get("amount");
    const userWalletAddress = searchParams.get("userWalletAddress");
    const quoteId = searchParams.get("quoteId");

    if (!toToken || !amount || !userWalletAddress || !quoteId) {
      return NextResponse.json(
        { error: "Missing required parameters: toToken, amount, userWalletAddress, quoteId" },
        { status: 400 }
      );
    }

    // Validate that userWalletAddress is not the dead address for trading
    const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
    if (userWalletAddress?.toLowerCase() === DEAD_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot use dead address for real trading" },
        { status: 400 }
      );
    }

    const result = await getAggregatorSwap(toToken, amount, userWalletAddress, quoteId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in swap API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}