import { NextResponse } from "next/server";
import { getAggregatorQuote } from "@/lib/binance";

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

    if (!toToken || !amount || !userWalletAddress) {
      return NextResponse.json(
        { error: "Missing required parameters: toToken, amount, userWalletAddress" },
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

    const result = await getAggregatorQuote(toToken, amount, userWalletAddress);
    // Aggregator returns an array — take the best (first) quote
    const quote = result?.data?.[0] ?? null;
    if (!quote) {
      return NextResponse.json(
        { error: "No quote returned from aggregator" },
        { status: 502 }
      );
    }
    return NextResponse.json(quote);
  } catch (error: any) {
    console.error("Error in quote API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}