import { type NextRequest, NextResponse } from "next/server"
import { walletService } from "@/lib/wallet"
import { AuthServerService } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
  try {
    const userData = await AuthServerService.getUserFromRequest(request)
    const userEmail = userData?.email

    if (!userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Checking pending transactions for user:", userEmail)

    // Check for stale pending transactions (older than 5 minutes for testing, should be longer in production)
    const staleTransactions = await walletService.findStalePendingTransactions(userEmail, 5)

    let processedCount = 0

    for (const transaction of staleTransactions) {
      console.log(
        "[v0] Processing stale transaction:",
        transaction.id,
        "ion-AP ID:",
        transaction.metadata?.ion_ap_transaction_id,
      )

      // Try to get status from ion-AP API
      const ionApTransactionId = transaction.metadata?.ion_ap_transaction_id
      const ionApStatus = await checkIonApTransactionStatus(ionApTransactionId)

      if (ionApStatus === "success") {
        console.log("[v0] MDN received for transaction:", transaction.id)
        const result = await walletService.completePendingTransaction(transaction.id, ionApTransactionId)
        if (result.success) {
          console.log("[v0] Completed stale transaction:", transaction.id)
          processedCount++
        } else {
          console.error("[v0] Failed to complete transaction:", result.error)
        }
      } else if (ionApStatus === "failed") {
        console.log("[v0] Transaction failed, canceling:", transaction.id)
        const result = await walletService.cancelPendingTransaction(
          transaction.id,
          "Transaction failed - no MDN received",
        )
        if (result.success) {
          console.log("[v0] Canceled failed transaction:", transaction.id)
          processedCount++
        } else {
          console.error("[v0] Failed to cancel transaction:", result.error)
        }
      } else {
        console.log("[v0] Transaction still pending:", transaction.id)
        // For now, cancel after timeout (in production, this should be longer)
        const result = await walletService.cancelPendingTransaction(
          transaction.id,
          "Timeout - no MDN received within time limit",
        )
        if (result.success) {
          console.log("[v0] Canceled timed-out transaction:", transaction.id)
          processedCount++
        }
      }
    }

    return NextResponse.json({
      message: `Processed ${processedCount} pending transactions`,
      processed: processedCount,
      checked: staleTransactions.length,
    })
  } catch (error) {
    console.error("[v0] Check pending transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function checkIonApTransactionStatus(ionApTransactionId: string): Promise<"success" | "failed" | "pending"> {
  if (!ionApTransactionId) {
    console.log("[v0] No ion-AP transaction ID provided")
    return "failed"
  }

  try {
    console.log("[v0] Checking ion-AP transaction status for ID:", ionApTransactionId)

    // Get authentication tokens from environment or storage
    const ionApBaseUrl = "https://test.ion-ap.net/api/v2"

    // This would need proper authentication - for now, simulate the check
    // In a real implementation, you would:
    // 1. Get the transaction status from ion-AP API
    // 2. Check if MDN (receipt) has been received
    // 3. Return appropriate status

    const response = await fetch(`${ionApBaseUrl}/send-transactions/${ionApTransactionId}`, {
      headers: {
        // Add proper authentication headers here
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      console.log("[v0] Failed to fetch transaction status from ion-AP:", response.status)
      return "pending"
    }

    const transactionData = await response.json()
    console.log("[v0] ion-AP transaction status:", transactionData.state)

    // Map ion-AP states to our status
    switch (transactionData.state) {
      case "DELIVERED":
      case "ACKNOWLEDGED":
        return "success"
      case "FAILED":
      case "REJECTED":
        return "failed"
      case "QUEUED":
      case "SENT":
      case "PROCESSING":
      default:
        return "pending"
    }
  } catch (error) {
    console.error("[v0] Error checking ion-AP transaction status:", error)
    return "pending"
  }
}
