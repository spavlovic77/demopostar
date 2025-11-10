import { type NextRequest, NextResponse } from "next/server"

const defaultBalance = {
  available_balance: 0,
  reserved_balance: 0,
  total_balance: 0,
}

export async function GET(request: NextRequest) {
  try {
    const { ServerAuthService } = await import("@/lib/auth-server")
    const { walletService } = await import("@/lib/wallet")

    console.log("[v0] Balance API called")
    const authHeader = request.headers.get("Authorization")
    console.log("[v0] Auth header present:", !!authHeader)

    const user = await ServerAuthService.getUserFromRequest(request)
    console.log("[v0] User from request:", user ? user.email : "null")

    if (!user) {
      console.log("[v0] No user found, returning default balance")
      return NextResponse.json(defaultBalance)
    }

    console.log("[v0] Fetching balance for user:", user.email)

    const balance = await walletService.getBalance(user.email)

    if (!balance) {
      console.log("[v0] No balance found, returning default balance")
      return NextResponse.json(defaultBalance)
    }

    console.log("[v0] Balance fetched successfully:", balance)
    return NextResponse.json(balance)
  } catch (error) {
    console.error("[v0] Error in balance API:", error)
    return NextResponse.json(defaultBalance)
  }
}
