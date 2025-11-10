import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    console.log("[v0] Marking transaction as read:", params.id)

    const response = await fetch(`${ION_AP_BASE_URL}/api/v2/receive-transactions/${params.id}/mark-read`, {
      method: "POST",
      headers: {
        Authorization: `JWT ${token}`,
        "Content-Type": "application/json",
      },
    })

    console.log("[v0] Mark-read response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Mark as read failed:", response.status, errorText)
      return NextResponse.json({ error: errorText }, { status: response.status })
    }

    const contentType = response.headers.get("content-type")
    const contentLength = response.headers.get("content-length")

    console.log("[v0] Response content-type:", contentType, "content-length:", contentLength)

    // If response is empty or has no content, return success
    if (!contentType || contentLength === "0") {
      console.log("[v0] Empty response, returning success")
      return NextResponse.json({ success: true })
    }

    // Try to parse JSON only if content-type indicates JSON
    if (contentType.includes("application/json")) {
      const text = await response.text()
      console.log("[v0] Response text:", text)

      if (!text || text.trim() === "") {
        console.log("[v0] Empty JSON response, returning success")
        return NextResponse.json({ success: true })
      }

      const data = JSON.parse(text)
      return NextResponse.json(data)
    }

    // For other content types, return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error marking as read:", error)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
