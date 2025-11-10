import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    console.log("[v0] Login attempt for email:", email)

    if (!email || !password) {
      console.log("[v0] Missing email or password")
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    console.log("[v0] Making login request to:", `${ION_AP_BASE_URL}/auth/obtain_jwt_token`)

    const response = await fetch(`${ION_AP_BASE_URL}/auth/obtain_jwt_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    console.log("[v0] Login API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] Login API error response:", errorText)
      return NextResponse.json({ error: "Invalid credentials" }, { status: response.status })
    }

    const ionApData = await response.json()
    console.log("[v0] ion-AP login successful")

    // Focus on ion-AP authentication only for now

    console.log("[v0] Returning ion-AP tokens")
    return NextResponse.json(ionApData)
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
