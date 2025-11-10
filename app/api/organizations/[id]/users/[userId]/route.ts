import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"
const ADMIN_TOKEN = "adba439948539073c0bdb9873206ea8bc34999fc"

export async function GET(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const { id: organizationId, userId } = params

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/users/${userId}`, {
      headers: {
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ion-AP user fetch failed:", response.status, errorText)
      return NextResponse.json({ error: "Failed to fetch user", detail: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] User fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const { id: organizationId, userId } = params

    console.log("[v0] Deleting user from organization:", { organizationId, userId })

    const response = await fetch(`${ION_AP_BASE_URL}/organizations/${organizationId}/users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] ion-AP user deletion failed:", response.status, errorText)
      return NextResponse.json(
        { error: "Failed to delete user from ion-AP", detail: errorText },
        { status: response.status },
      )
    }

    console.log("[v0] User deleted successfully from ion-AP")

    return NextResponse.json({ success: true, message: "User deleted successfully" })
  } catch (error) {
    console.error("[v0] User deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
