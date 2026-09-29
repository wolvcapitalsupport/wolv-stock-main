import { NextResponse } from "next/server";
import { submitOrder } from "@/lib/binance";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();
    const {
      requestId,
      userSignature,
      vendor,
      quoteId
    } = body;

    if (!requestId || !userSignature || !vendor || !quoteId) {
      return NextResponse.json(
        { error: "Missing required parameters: requestId, userSignature, vendor, quoteId" },
        { status: 400 }
      );
    }

    // Basic UUID validation for requestId (should be UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return NextResponse.json(
        { error: "requestId must be a valid UUID v4" },
        { status: 400 }
      );
    }

    const result = await submitOrder(requestId, userSignature, vendor, quoteId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in order submit API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}