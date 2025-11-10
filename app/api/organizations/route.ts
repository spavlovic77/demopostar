import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"
const ADMIN_TOKEN = "adba439948539073c0bdb9873206ea8bc34999fc"

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${ION_AP_BASE_URL}/organizations`, {
      headers: {
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Organizations fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, country, publish_in_smp = true } = body

    console.log("[v0] Organization creation request:", { name, country, publish_in_smp })

    if (!name || !country) {
      return NextResponse.json({ error: "Organization name and country are required" }, { status: 400 })
    }

    console.log("[v0] Making API call to:", `${ION_AP_BASE_URL}/organizations`)
    console.log("[v0] Using admin token:", ADMIN_TOKEN.substring(0, 10) + "...")

    const response = await fetch(`${ION_AP_BASE_URL}/organizations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ name, country, publish_in_smp }),
    })

    console.log("[v0] API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] API error response:", errorText)
      return NextResponse.json(
        {
          error: "Failed to create organization",
          details: errorText,
          status: response.status,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("[v0] Organization created successfully:", data)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Organization creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
