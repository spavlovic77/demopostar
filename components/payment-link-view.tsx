"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ExternalLink, Loader2, AlertCircle, Smartphone, Monitor, CheckCircle2 } from "lucide-react"

interface PaymentLinkViewProps {
  amount: number
  onClose: () => void
  onPaymentSuccess?: () => void
}

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: "-10%",
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"][Math.floor(Math.random() * 5)],
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function PaymentLinkView({ amount, onClose, onPaymentSuccess }: PaymentLinkViewProps) {
  const [deviceType, setDeviceType] = useState<"desktop" | "mobile" | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [paymentNotification, setPaymentNotification] = useState<any>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  const hasGeneratedRef = useRef(false)

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(userAgent)
    const isAndroid = /android/.test(userAgent)

    if (isIOS || isAndroid) {
      setDeviceType("mobile")
    } else {
      setDeviceType("desktop")
    }
  }, [])

  useEffect(() => {
    if (deviceType && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true
      generatePaymentLink()
    }
  }, [deviceType])

  const generatePaymentLink = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
            }
          : null

      if (!tokens?.access) {
        setError("Authentication required")
        return
      }

      const response = await fetch("/api/wallet/payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({
          amount: amount,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate payment link")
      }

      const data = await response.json()
      const txnId = data.transactionId

      setTransactionId(txnId)

      const paymentLinkUrl = constructPaymentLink(txnId, amount)
      setPaymentLink(paymentLinkUrl)

      if (deviceType === "desktop") {
        const qrUrl = await generateQRCode(paymentLinkUrl)
        setQrCodeUrl(qrUrl)
      }

      listenForPaymentNotification(txnId)
    } catch (err) {
      console.error("Error generating payment link:", err)
      setError(err instanceof Error ? err.message : "Failed to generate payment link")
    } finally {
      setIsLoading(false)
    }
  }

  const listenForPaymentNotification = async (txnId: string) => {
    try {
      setIsListening(true)

      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
            }
          : null

      if (!tokens?.access) {
        return
      }

      const response = await fetch("/api/wallet/payment-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({
          transactionId: txnId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Failed to subscribe to payment notifications:", errorData)
        return
      }

      const data = await response.json()

      if (data.success && data.notification) {
        setPaymentNotification(data.notification)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)

        await processPayment(txnId, data.notification)
      }
    } catch (err) {
      console.error("Error listening for payment notification:", err)
    } finally {
      setIsListening(false)
    }
  }

  const constructPaymentLink = (endToEndId: string, amountEUR: number): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const dueDate = `${year}${month}${day}`

    const params = new URLSearchParams({
      V: "1",
      IBAN: "SK7811000000002944276572",
      AM: amountEUR.toFixed(2),
      CC: "EUR",
      PI: endToEndId,
      DT: dueDate, // Added due date parameter
      MSG: "Navýšenie kreditu",
      CN: "efabox s.r.o.",
    })

    return `https://payme.sk/?${params.toString()}`
  }

  const generateQRCode = async (url: string): Promise<string> => {
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`
      return qrApiUrl
    } catch (err) {
      console.error("Error generating QR code:", err)
      throw err
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const processPayment = async (transactionId: string, notification: any) => {
    try {
      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
            }
          : null

      if (!tokens?.access) {
        return
      }

      const response = await fetch("/api/wallet/process-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({
          amount: amount,
          transactionId: transactionId,
          notification: notification,
        }),
      })

      if (response.ok) {
        console.log("[v0] Payment processed successfully, refreshing balance")
        // Call the callback to refresh balance in parent component
        if (onPaymentSuccess) {
          onPaymentSuccess()
        }
      } else {
        console.error("[v0] Failed to process payment:", await response.text())
      }
    } catch (error) {
      console.error("[v0] Error processing payment:", error)
    }
  }

  if (isLoading) {
    return (
      <>
        <CardHeader>
          <CardTitle>Generujem platbu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg">Generujem platobný odkaz...</p>
              <p className="text-sm text-muted-foreground mt-1">Prosím chvíľu počkajte</p>
            </div>
          </div>
        </CardContent>
      </>
    )
  }

  if (error) {
    return (
      <>
        <CardHeader>
          <CardTitle className="text-destructive">Chyba</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={onClose} variant="outline" className="w-full bg-transparent">
            Zavrieť
          </Button>
        </CardContent>
      </>
    )
  }

  if (paymentNotification) {
    return (
      <>
        {showConfetti && <Confetti />}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-green-600">Platba prijatá!</CardTitle>
                <CardDescription className="text-xs mt-0.5 text-green-600">Vaša platba bola potvrdená</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 animate-in slide-in-from-bottom">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              Platba vo výške €{amount.toFixed(2)} bola úspešne prijatá a pridaná na váš účet.
            </AlertDescription>
          </Alert>

          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <p className="text-sm font-medium text-muted-foreground mb-2">Suma na zaplatenie</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                  €{paymentNotification.transactionAmount?.amount || amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-muted/50 to-muted p-4 rounded-lg space-y-3 animate-in slide-in-from-bottom delay-150">
            <p className="text-sm font-medium">Detaily platby</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Suma</p>
                <p className="font-medium text-lg text-green-600">
                  €{paymentNotification.transactionAmount?.amount || amount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Mena</p>
                <p className="font-medium">{paymentNotification.transactionAmount?.currency || "EUR"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">ID transakcie</p>
                <p className="font-mono text-xs break-all">{paymentNotification.endToEndId || transactionId}</p>
              </div>
            </div>
          </div>

          <Button onClick={onClose} className="w-full" size="lg">
            Zavrieť
          </Button>
        </CardContent>
      </>
    )
  }

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {deviceType === "mobile" ? (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Monitor className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <CardTitle className="text-xl">
                {deviceType === "mobile" ? "Mobilná platba" : "Platba QR kódom"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {deviceType === "mobile" ? "Jednoduchá a rýchla platba" : "Naskenujte telefónom"}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pb-6">
        {isListening && (
          <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 p-6">
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">Čakám na platbu...</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  Dokončite platbu vo vašej bankovej aplikácii. Automaticky vás upozorním po potvrdení.
                </p>
                <div className="flex items-center gap-1.5 mt-3">
                  {[0, 150, 300].map((delay, i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-sm font-medium text-muted-foreground mb-2">Suma na zaplatenie</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                €{amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {deviceType === "mobile" && paymentLink && (
          <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="block">
            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/20"
              size="lg"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Otvoriť bankovú aplikáciu
            </Button>
          </a>
        )}

        {deviceType === "desktop" && qrCodeUrl && (
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-2xl" />
              <div className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-xl border border-primary/10">
                <img src={qrCodeUrl || "/placeholder.svg"} alt="Platobný QR kód" className="w-56 h-56 rounded-lg" />
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Smartphone className="h-3 w-3" />
                  <span>Naskenujte kamerou telefónu</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <Button variant="ghost" onClick={onClose} className="w-full hover:bg-muted/50">
          Zrušiť
        </Button>
      </CardContent>
    </>
  )
}
