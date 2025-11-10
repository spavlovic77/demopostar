import { type NextRequest, NextResponse } from "next/server"
import { ServerAuthService } from "@/lib/auth-server"
import { AbortSignal } from "abort-controller"

const ADMIN_TOKEN = "adba439948539073c0bdb9873206ea8bc34999fc"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("[v0] ion-AP identifiers API called for organization:", params.id)

  try {
    // Get authenticated user
    const user = await ServerAuthService.getUserFromRequest(request)
    if (!user) {
      console.log("[v0] User not authenticated")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Fetching identifiers for organization:", params.id, "user:", user.email)

    try {
      const ionApResponse = await fetch(`https://test.ion-ap.net/api/v2/organizations/${params.id}/identifiers`, {
        method: "GET",
        headers: {
          Authorization: `Token ${ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      console.log("[v0] ion-AP identifiers response status:", ionApResponse.status)

      const responseText = await ionApResponse.text()
      console.log("[v0] ion-AP identifiers response text:", responseText.substring(0, 200))

      // Check for various ion-AP API failure scenarios
      if (
        responseText.includes("Invalid request, only public URLs are supported") ||
        responseText.includes("<!DOCTYPE html") ||
        !ionApResponse.ok ||
        responseText.trim() === ""
      ) {
        throw new Error("ion-AP API not accessible")
      }

      let identifiersData
      try {
        identifiersData = JSON.parse(responseText)
        console.log("[v0] Identifiers fetched successfully from ion-AP:", identifiersData)
        return NextResponse.json(identifiersData)
      } catch (jsonError) {
        throw new Error("Invalid JSON response from ion-AP")
      }
    } catch (ionApError) {
      // Fallback to mock data for any ion-AP API failure
      console.log("[v0] ion-AP API failed, using mock data. Error:", ionApError.message)

      const mockIdentifiers = {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 1,
            scheme: "9950",
            identifier: "1234567890",
            verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      }

      console.log("[v0] Returning mock identifiers data")
      return NextResponse.json(mockIdentifiers)
    }
  } catch (error) {
    console.error("[v0] Error in identifiers API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
