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

    const response = await fetch(`${ION_AP_BASE_URL}/send-transactions?${params.toString()}`, {
      headers: {
        Authorization: `JWT ${token}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch sent documents" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Sent documents fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
