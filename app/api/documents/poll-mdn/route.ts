import { type NextRequest, NextResponse } from "next/server"
import { walletService } from "@/lib/wallet"
import { ServerAuthService } from "@/lib/auth-server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

interface PollRequest {
  transactionId: string
  ionApTransactionId: string
  stage: "initial" | "secondary" | "tertiary" | "hourly"
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const userToken = authHeader.substring(7) // Extract token from "Bearer <token>"

    const { transactionId, ionApTransactionId, stage }: PollRequest = await request.json()

    console.log(`[v0] Polling for document state - Transaction: ${ionApTransactionId}, Stage: ${stage}`)

    const refreshToken = request.headers.get("X-Refresh-Token")

    // Check ion-AP for document state
    try {
      const { response, newTokens } = await ServerAuthService.makeAuthenticatedRequest(
        `${ION_AP_BASE_URL}/send-transactions/${ionApTransactionId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
        userToken,
        refreshToken || undefined,
      )

      if (response.ok) {
        const sendTransactionData = await response.json()
        console.log(`[v0] ion-AP send transaction state:`, sendTransactionData.state)

        const responseData: any = {
          status: "polling",
          state: sendTransactionData.state,
          document_data: sendTransactionData,
          stage,
          next_poll_scheduled: true,
        }

        if (newTokens) {
          responseData.new_tokens = newTokens
        }

        if (sendTransactionData.state === "SENT") {
          console.log(`[v0] Document SENT for transaction ${ionApTransactionId}, completing financial transaction`)

          // Try to complete the financial transaction if it still exists
          if (transactionId) {
            const result = await walletService.completePendingTransaction(transactionId, ionApTransactionId)
            if (result.success) {
              console.log(`[v0] Financial transaction completed successfully`)
            } else {
              console.log(`[v0] Financial transaction already completed or not found: ${result.error}`)
            }
          }

          return NextResponse.json({
            ...responseData,
            status: "completed",
            state: "SENT",
          })
        } else if (sendTransactionData.state === "ERROR") {
          console.log(`[v0] Document ERROR for transaction ${ionApTransactionId}, unlocking reserved funds`)

          // Try to cancel the financial transaction if it still exists
          if (transactionId) {
            await walletService.cancelPendingTransaction(transactionId, `Document error: ${sendTransactionData.state}`)
          }

          return NextResponse.json({
            ...responseData,
            status: "failed",
            state: "ERROR",
          })
        } else if (sendTransactionData.state === "DEFERRED") {
          console.log(`[v0] Document DEFERRED for transaction ${ionApTransactionId}, continuing progressive polling`)

          return NextResponse.json({
            ...responseData,
            status: "deferred",
            state: "DEFERRED",
          })
        } else {
          return NextResponse.json(responseData)
        }
      } else {
        console.error(`[v0] Failed to fetch send transaction state: ${response.status}`)
        const errorText = await response.text()
        console.error(`[v0] ion-AP API error response:`, errorText)

        return NextResponse.json(
          {
            status: "error",
            error: `Failed to fetch document state: ${response.status}`,
            details: errorText,
          },
          { status: response.status },
        )
      }
    } catch (pollError) {
      console.error(`[v0] Error polling ion-AP for send transaction state:`, pollError)
      return NextResponse.json(
        {
          status: "error",
          error: "Failed to poll document state",
          details: pollError instanceof Error ? pollError.message : String(pollError),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("[v0] Poll document state error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getNextPollingStage(currentStage: string, createdAt: string): { stage: string } | null {
  const now = new Date()
  const created = new Date(createdAt)
  const elapsedMinutes = (now.getTime() - created.getTime()) / (1000 * 60)

  switch (currentStage) {
    case "initial": // After 3 seconds
      return { stage: "secondary" }
    case "secondary": // After 10 seconds
      return { stage: "tertiary" }
    case "tertiary": // After 1 minute
      return { stage: "hourly" }
    case "hourly": // Every hour, but stop after 24 hours
      return elapsedMinutes < 24 * 60 ? { stage: "hourly" } : null
    default:
      return null
  }
}

function getPollingDelay(stage: string): number {
  switch (stage) {
    case "secondary":
      return 7000 // 10 seconds total (3 + 7)
    case "tertiary":
      return 50000 // 1 minute total (10 + 50 seconds)
    case "hourly":
      return 3540000 // 59 minutes (to poll every hour)
    default:
      return 3000
  }
}
