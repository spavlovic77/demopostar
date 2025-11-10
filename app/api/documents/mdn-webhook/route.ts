import { type NextRequest, NextResponse } from "next/server"
import { walletService } from "@/lib/wallet"

export async function POST(request: NextRequest) {
  try {
    const mdnData = await request.json()
    console.log("[v0] MDN received:", mdnData)

    // Extract transaction details from MDN
    const ionApTransactionId = mdnData.transaction_id || mdnData.id
    const status = mdnData.status || mdnData.disposition
    const isSuccess = status === "processed" || status === "delivered" || mdnData.success === true

    if (!ionApTransactionId) {
      console.error("[v0] MDN missing transaction ID")
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 })
    }

    // Find pending transaction by ion-AP transaction ID
    const pendingTransaction = await walletService.findPendingTransactionByReference(ionApTransactionId)

    if (!pendingTransaction) {
      console.log("[v0] No pending transaction found for ion-AP ID:", ionApTransactionId)
      return NextResponse.json({ message: "Transaction not found or already processed" })
    }

    if (isSuccess) {
      console.log("[v0] MDN indicates success, completing transaction:", pendingTransaction.id)
      const result = await walletService.completePendingTransaction(pendingTransaction.id, ionApTransactionId)

      if (result.success) {
        console.log("[v0] Transaction completed successfully via MDN")
      } else {
        console.error("[v0] Failed to complete transaction via MDN:", result.error)
      }
    } else {
      console.log("[v0] MDN indicates failure, canceling transaction:", pendingTransaction.id)
      const result = await walletService.cancelPendingTransaction(
        pendingTransaction.id,
        `MDN failure: ${status || "unknown error"}`,
      )

      if (result.success) {
        console.log("[v0] Transaction canceled successfully via MDN")
      } else {
        console.error("[v0] Failed to cancel transaction via MDN:", result.error)
      }
    }

    return NextResponse.json({ message: "MDN processed successfully" })
  } catch (error) {
    console.error("[v0] MDN webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
