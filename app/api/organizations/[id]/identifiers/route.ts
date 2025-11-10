import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"
const ADMIN_TOKEN = "adba439948539073c0bdb9873206ea8bc34999fc"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const organizationId = params.id

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/identifiers`, {
      headers: {
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch identifiers" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Identifiers fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { scheme, identifier, verified = true } = body
    const organizationId = params.id

    if (!scheme || !identifier) {
      return NextResponse.json({ error: "Scheme and identifier are required" }, { status: 400 })
    }

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/identifiers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        scheme: "iso6523-actorid-upis",
        identifier: `${scheme}:${identifier}`,
        verified,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: "Failed to add identifier" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Identifier creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
