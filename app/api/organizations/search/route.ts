import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"
const ADMIN_TOKEN = "adba439948539073c0bdb9873206ea8bc34999fc"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const name = searchParams.get("name")
    const identifier = searchParams.get("identifier")

    if (!name && !identifier) {
      return NextResponse.json({ error: "Organization name or identifier required" }, { status: 400 })
    }

    // Build search URL based on provided parameter
    let searchUrl = `${ION_AP_BASE_URL}/organizations?`
    if (identifier) {
      searchUrl += `filter_identifier=${encodeURIComponent(identifier)}`
      console.log("[v0] Searching for organization by identifier:", identifier)
    } else if (name) {
      searchUrl += `filter_name=${encodeURIComponent(name)}`
      console.log("[v0] Searching for organization by name:", name)
    }

    // Search for organization
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
    })

    if (!searchResponse.ok) {
      console.log("[v0] Organization search failed:", searchResponse.status)
      return NextResponse.json({ error: "Failed to search organizations" }, { status: searchResponse.status })
    }

    const searchData = await searchResponse.json()
    console.log("[v0] Search results:", searchData)

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // Get the first matching organization's ID
    const orgId = searchData.results[0].id

    // Fetch full organization details
    const detailsResponse = await fetch(`${ION_AP_BASE_URL}/organizations/${orgId}`, {
      headers: {
        Authorization: `Token ${ADMIN_TOKEN}`,
      },
    })

    if (!detailsResponse.ok) {
      console.log("[v0] Organization details fetch failed:", detailsResponse.status)
      return NextResponse.json({ error: "Failed to fetch organization details" }, { status: detailsResponse.status })
    }

    const detailsData = await detailsResponse.json()
    console.log("[v0] Organization details:", detailsData)

    return NextResponse.json(detailsData)
  } catch (error) {
    console.error("[v0] Organization search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
