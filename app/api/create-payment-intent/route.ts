import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import Stripe from "stripe"

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY

    if (!secretKey) {
      console.error("[v0] STRIPE_SECRET_KEY is not configured")
      return NextResponse.json({ error: "Stripe nie je nakonfigurované" }, { status: 500 })
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2024-04-10",
    })

    const { amount } = await request.json()

    // Validate amount
    if (!amount || typeof amount !== "number" || amount < 100) {
      return NextResponse.json({ error: "Neplatná suma (minimum €1.00)" }, { status: 400 })
    }

    if (amount > 200) {
      return NextResponse.json({ error: "Neplatná suma (maximum €2.00)" }, { status: 400 })
    }

    console.log("[v0] Creating payment intent for amount:", amount)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        source: "wallet_topup",
      },
    })

    console.log("[v0] Payment intent created:", paymentIntent.id)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error: any) {
    console.error("[v0] Payment intent creation error:", error)

    return NextResponse.json(
      {
        error: error.message || "Chyba pri vytváraní platby",
      },
      { status: 500 },
    )
  }
}
