"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, AlertCircle, Shield } from "lucide-react"

let stripePromise: Promise<Stripe | null> | null = null

const getStripe = () => {
  if (!stripePromise) {
    const publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      "pk_live_51ReFqiAhBFZZcvjo2D6IrIwBqUY3XEdbHm96KuO7Ir0Bme8updwgcR47oMLsrzxcF2vyQ2PkLJCYYuOf8kYq9UZs008GjLET8U"

    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

interface CheckoutFormProps {
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

function CheckoutForm({ amount, onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setErrorMessage("")

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard`,
        },
        redirect: "if_required",
      })

      if (error) {
        setErrorMessage(error.message || "Platba zlyhala")
        setIsProcessing(false)
      } else {
        onSuccess()
      }
    } catch (err) {
      console.error("[v0] Payment error:", err)
      setErrorMessage("Nastala neočakávaná chyba")
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement
          options={{
            layout: "tabs",
            paymentMethodOrder: ["card", "apple_pay", "google_pay"],
          }}
        />
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Spracovávam platbu...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Zaplatiť €{amount.toFixed(2)}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="px-6 bg-transparent"
        >
          Zrušiť
        </Button>
      </div>
    </form>
  )
}

interface StripePaymentFormProps {
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

export function StripePaymentForm({ amount, onSuccess, onCancel }: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    initializePayment()
  }, [amount])

  const initializePayment = async () => {
    try {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Nepodarilo sa vytvoriť platbu")
      }

      const data = await response.json()
      setClientSecret(data.clientSecret)
    } catch (err) {
      console.error("[v0] Payment initialization error:", err)
      setError(err instanceof Error ? err.message : "Chyba inicializácie platby")
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Chyba platby
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button onClick={initializePayment} variant="default" className="flex-1">
              Skúsiť znova
            </Button>
            <Button onClick={onCancel} variant="outline">
              Zrušiť
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !clientSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Platba kartou
          </CardTitle>
          <CardDescription>Pripravujem platobnú bránu...</CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Načítavam Stripe...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          Platba kartou
        </CardTitle>
        <CardDescription className="text-base">Dokončite dobíjanie kreditu v sume €{amount.toFixed(2)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-300">
            <strong>Zabezpečená platba</strong> - Vaše údaje sú šifrované pomocou Stripe
          </AlertDescription>
        </Alert>

        <Elements
          stripe={getStripe()}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#16a34a",
                colorBackground: "#ffffff",
                colorText: "#1f2937",
                colorDanger: "#dc2626",
                fontFamily: "system-ui, -apple-system, sans-serif",
                borderRadius: "8px",
                spacingUnit: "4px",
              },
              rules: {
                ".Input": {
                  padding: "12px",
                  fontSize: "16px",
                },
                ".Label": {
                  fontSize: "14px",
                  fontWeight: "500",
                },
              },
            },
            locale: "sk",
          }}
        >
          <CheckoutForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
        </Elements>
      </CardContent>
    </Card>
  )
}
