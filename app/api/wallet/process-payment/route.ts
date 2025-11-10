import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { ServerAuthService } = await import("@/lib/auth-server")
    const { walletService } = await import("@/lib/wallet")

    const user = await ServerAuthService.getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { amount, transactionId, notification } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 })
    }

    console.log("[v0] Processing payment for user:", user.email, "amount:", amount, "txn:", transactionId)

    // Add funds to user's wallet
    const result = await walletService.addFunds(user.email, amount, `Navýšenie kreditu - ${transactionId}`, {
      type: "bank_transfer_qr",
      transaction_id: transactionId,
      notification: notification,
      processed_at: new Date().toISOString(),
    })

    if (!result.success) {
      console.error("[v0] Failed to add funds:", result.error)
      return NextResponse.json({ error: result.error || "Failed to process payment" }, { status: 400 })
    }

    console.log("[v0] Payment processed successfully, funds added to account")

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      amount: amount,
    })
  } catch (error) {
    console.error("[v0] Error in process-payment API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        success: false,
      },
      { status: 500 },
    )
  }
}
