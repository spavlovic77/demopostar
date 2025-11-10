import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { walletService } from "@/lib/wallet"
import { AuthServerService } from "@/lib/auth-server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const xmlContent = await request.text()

    if (!xmlContent) {
      return NextResponse.json({ error: "XML document content is required" }, { status: 400 })
    }

    const userData = await AuthServerService.getUserFromRequest(request)
    const userEmail = userData?.email || null

    if (!userEmail) {
      console.log("[v0] No authenticated user found, proceeding without wallet integration")
    }

    let transactionId: string | null = null

    if (userEmail) {
      console.log("[v0] Checking wallet balance and reserving funds for user:", userEmail)

      const supabase = await createClient()

      const { data: pricing, error: pricingError } = await supabase
        .from("pricing_config")
        .select("price_per_transaction")
        .eq("service_type", "SEND_DOCUMENT")
        .eq("is_active", true)
        .single()

      const documentFee = pricing?.price_per_transaction || 0.01 // Updated default fee from 0.5 to 0.01 EUR

      console.log("[v0] Document sending fee:", documentFee)

      const balance = await walletService.getBalance(userEmail)
      if (!balance) {
        return NextResponse.json({ error: "Failed to check wallet balance" }, { status: 500 })
      }

      if (balance.available_balance < documentFee) {
        return NextResponse.json(
          {
            error: "Insufficient funds",
            required: documentFee,
            available: balance.available_balance,
          },
          { status: 402 },
        )
      }

      console.log("[v0] Funds will be reserved after successful API connection")
    }

    try {
      console.log("[v0] Sending document to ion-AP using correct endpoint")

      const response = await fetch(`${ION_AP_BASE_URL}/send-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          Authorization: `JWT ${token}`,
        },
        body: xmlContent,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] ion-AP send failed:", errorText)
        return NextResponse.json({ error: "Failed to send document" }, { status: response.status })
      }

      const data = await response.json()
      console.log("[v0] Document sent successfully:", data)

      if (userEmail) {
        const supabase = await createClient()
        const { data: pricing } = await supabase
          .from("pricing_config")
          .select("price_per_transaction")
          .eq("service_type", "SEND_DOCUMENT")
          .eq("is_active", true)
          .single()

        const documentFee = pricing?.price_per_transaction || 0.01 // Updated default fee from 0.001 to 0.01 EUR

        const reservationResult = await walletService.reserveFunds(userEmail, documentFee, "send_document", {
          document_type: "peppol_bis",
          file_size: xmlContent.length,
          ion_ap_transaction_id: data.id?.toString(),
        })

        if (!reservationResult.success) {
          console.error("[v0] Failed to reserve funds after successful send:", reservationResult.error)
          // Document was sent but funds couldn't be reserved - this is a critical error
          return NextResponse.json(
            {
              error: "Document sent but failed to reserve funds",
              ion_ap_transaction_id: data.id,
            },
            { status: 500 },
          )
        }

        transactionId = reservationResult.transactionId!
        console.log("[v0] Funds reserved successfully after API connection, transaction ID:", transactionId)

        const ionApTransactionId = data.id?.toString()

        // Update the pending transaction with ion-AP transaction ID
        await walletService.updatePendingTransactionMetadata(transactionId, {
          ion_ap_transaction_id: ionApTransactionId,
          document_sent_at: new Date().toISOString(),
          polling_stage: "initial",
        })

        setTimeout(async () => {
          try {
            await fetch(`${request.nextUrl.origin}/api/documents/poll-mdn`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transactionId,
                ionApTransactionId,
                stage: "initial", // 3 seconds
              }),
            })
          } catch (pollError) {
            console.error("[v0] Failed to trigger initial polling:", pollError)
          }
        }, 3000)
      }

      return NextResponse.json({
        id: data.id,
        state: data.state || "QUEUED",
        sender_identifier: data.sender_identifier,
        receiver_identifier: data.receiver_identifier,
        document_element: data.document_element,
        document_id: data.document_id,
        transaction_id: data.transaction_id,
        created_on: data.created_on,
        last_updated_on: data.last_updated_on,
        wallet_transaction_id: transactionId,
        status: "pending_confirmation",
      })
    } catch (ionApError) {
      console.error("[v0] ion-AP request failed:", ionApError)

      if (transactionId) {
        console.log("[v0] Canceling reservation due to ion-AP error")
        await walletService.cancelPendingTransaction(transactionId, `Network error: ${ionApError}`)
      }

      throw ionApError
    }
  } catch (error) {
    console.error("[v0] Send document error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
