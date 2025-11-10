import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refresh } = body

    if (!refresh) {
      return NextResponse.json({ error: "Refresh token is required" }, { status: 400 })
    }

    const response = await fetch(`${ION_AP_BASE_URL}/auth/refresh_jwt_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Token refresh error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
