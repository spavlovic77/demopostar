import { type NextRequest, NextResponse } from "next/server"

const ION_AP_BASE_URL = "https://test.ion-ap.net"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    const response = await fetch(`${ION_AP_BASE_URL}/api/v2/send-transactions/${params.id}/receipt`, {
      headers: {
        Authorization: `JWT ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Receipt fetch failed:", response.status, errorText)
      return NextResponse.json({ error: errorText }, { status: response.status })
    }

    const receiptBlob = await response.blob()
    return new NextResponse(receiptBlob, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="receipt-${params.id}.xml"`,
      },
    })
  } catch (error) {
    console.error("Error fetching receipt:", error)
    return NextResponse.json({ error: "Failed to fetch receipt" }, { status: 500 })
  }
}
