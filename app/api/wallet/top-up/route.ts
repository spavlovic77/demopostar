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
    const { amount, reference } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    console.log("[v0] Processing top-up for user:", user.email, "amount:", amount)

    // Simulate bank wire processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const result = await walletService.addFunds(user.email, amount, `Bank wire top-up - ${reference || "Manual"}`, {
      type: "bank_wire_simulation",
      reference: reference,
      processed_at: new Date().toISOString(),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to add funds" }, { status: 400 })
    }

    console.log("[v0] Top-up completed successfully")

    return NextResponse.json({
      success: true,
      message: "Funds added successfully",
      amount: amount,
    })
  } catch (error) {
    console.error("[v0] Error in top-up API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        success: false,
      },
      { status: 500 },
    )
  }
}
