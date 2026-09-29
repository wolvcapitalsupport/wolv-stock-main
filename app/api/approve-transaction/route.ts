import { NextResponse } from "next/server";
import { getApproveTransaction } from "@/lib/binance";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ [key: string]: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenContractAddress = searchParams.get("tokenContractAddress");
    const approveAmount = searchParams.get("approveAmount");
    const userWalletAddress = searchParams.get("userWalletAddress");
    const vendor = searchParams.get("vendor");

    if (!tokenContractAddress || !approveAmount || !userWalletAddress) {
      return NextResponse.json(
        { error: "Missing required parameters: tokenContractAddress, approveAmount, userWalletAddress" },
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

    const result = await getApproveTransaction(
      tokenContractAddress,
      approveAmount,
      userWalletAddress,
      vendor === null ? undefined : vendor // Convert null to undefined for optional param
    );
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in approve-transaction API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}