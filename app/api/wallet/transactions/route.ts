import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { ServerAuthService } = await import("@/lib/auth-server")
    const { walletService } = await import("@/lib/wallet")

    const user = await ServerAuthService.getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    console.log("[v0] Fetching transaction history for user:", user.email)

    const transactions = await walletService.getTransactionHistory(user.email, limit)
    const pendingTransactions = await walletService.getPendingTransactions(user.email)

    console.log("[v0] Transaction history fetched:", {
      transactions: transactions.length,
      pending: pendingTransactions.length,
    })

    return NextResponse.json({
      transactions,
      pending_transactions: pendingTransactions,
    })
  } catch (error) {
    console.error("[v0] Error in transactions API:", error)
    return NextResponse.json({
      transactions: [],
      pending_transactions: [],
    })
  }
}
