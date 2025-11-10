import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const { searchParams } = new URL(request.url)

    // Forward all query parameters to the ion-AP API
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.append(key, value)
    })

    console.log("[v0] Received documents API called with params:", params.toString())
    console.log("[v0] filter_receiver value:", searchParams.get("filter_receiver"))

    const ionApUrl = `${ION_AP_BASE_URL}/receive-transactions?${params.toString()}`
    console.log("[v0] Calling ion-AP URL:", ionApUrl)

    const response = await fetch(ionApUrl, {
      headers: {
        Authorization: `JWT ${token}`,
      },
    })

    console.log("[v0] ion-AP response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] ion-AP error response:", errorText)
      return NextResponse.json({ error: "Failed to fetch received documents" }, { status: response.status })
    }

    const data = await response.json()
    console.log("[v0] ion-AP returned", data.count, "documents")

    if (data.results && data.results.length > 0) {
      console.log(
        "[v0] First document sample:",
        JSON.stringify({
          id: data.results[0].id,
          receiver_identifier: data.results[0].receiver_identifier,
          sender_identifier: data.results[0].sender_identifier,
          receiver: data.results[0].receiver,
          sender: data.results[0].sender,
        }),
      )

      // Log all receiver_identifier values to see what we're working with
      const receiverIds = data.results.map((doc: any) => ({
        id: doc.id,
        receiver_identifier: doc.receiver_identifier,
        receiver: doc.receiver,
      }))
      console.log("[v0] All receiver identifiers:", JSON.stringify(receiverIds))
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Received documents fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
