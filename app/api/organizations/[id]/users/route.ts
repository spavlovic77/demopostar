import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"
const ADMIN_TOKEN = "adba439948539073c0bdb9873206ea8bc34999fc"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 })
    }

    const organizationId = params.id

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/users`, {
      headers: {
        Authorization: authHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ion-AP users fetch failed:", response.status, errorText)

      if (response.status === 404) {
        return NextResponse.json({ results: [], detail: "Organization not found or no access" })
      }

      return NextResponse.json({ error: "Failed to fetch users", detail: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Users fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { email } = body
    const organizationId = params.id

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    console.log("[v0] Creating user in ion-AP for organization:", organizationId)

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ion-AP user creation failed:", errorText)
      return NextResponse.json({ error: "Failed to create user in ion-AP" }, { status: response.status })
    }

    const ionApUserData = await response.json()
    console.log("[v0] ion-AP user created successfully:", ionApUserData)

    return NextResponse.json(ionApUserData)
  } catch (error) {
    console.error("[v0] User creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const organizationId = params.id

    const url = new URL(request.url)
    const pathParts = url.pathname.split("/")
    const userId = pathParts[pathParts.length - 1]

    if (!userId || userId === params.id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    console.log("[v0] Deleting user from organization:", { organizationId, userId })

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `JWT ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ion-AP user deletion failed:", errorText)
      return NextResponse.json({ error: "Failed to delete user from ion-AP" }, { status: response.status })
    }

    console.log("[v0] User deleted successfully from ion-AP")

    return NextResponse.json({ success: true, message: "User deleted successfully" })
  } catch (error) {
    console.error("[v0] User deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
