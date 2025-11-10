import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    const response = await fetch(`${ION_AP_BASE_URL}/auth/create_auth_token`, {
      method: "POST",
      headers: {
        Authorization: `JWT ${token}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to create API token" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Create token error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
