"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Euro,
  Loader2,
  QrCode,
  TrendingUp,
  Smartphone,
} from "lucide-react"
import { PaymentLinkView } from "./payment-link-view"

interface WalletBalance {
  available_balance: number
  reserved_balance: number
  total_balance: number
}

interface Transaction {
  id: string
  transaction_type: string
  amount: number
  description: string
  created_at: string
  balance_before?: number
  balance_after?: number
  metadata?: any
}

interface PendingTransaction {
  id: string
  amount: number
  status: string
  transaction_type: string
  created_at: string
  metadata?: any
}

function useCountAnimation(end: number, duration = 1000, key?: string) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(0) // Reset to 0 before animating
    let startTimestamp: number | null = null
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      setCount(Math.floor(progress * (end * 100)) / 100) // Use decimal precision
      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setCount(end) // Ensure final value is exact
      }
    }
    window.requestAnimationFrame(step)
  }, [end, duration, key])

  return count
}

interface WalletManagementProps {
  onBalanceUpdate?: () => void
}

export function WalletManagement({ onBalanceUpdate }: WalletManagementProps) {
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isBalanceLoading, setIsBalanceLoading] = useState(true)
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true)
  const [topUpAmount, setTopUpAmount] = useState("")
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [balanceUpdated, setBalanceUpdated] = useState(false)
  const [isTopUpLoading, setIsTopUpLoading] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [isMobilePaymentLoading, setIsMobilePaymentLoading] = useState(false)

  const animatedAvailable = useCountAnimation(
    balance?.available_balance || 0,
    1000,
    `available-${balance?.available_balance}`,
  )
  const animatedReserved = useCountAnimation(
    balance?.reserved_balance || 0,
    1000,
    `reserved-${balance?.reserved_balance}`,
  )
  const animatedTotal = useCountAnimation(balance?.total_balance || 0, 1000, `total-${balance?.total_balance}`)

  const [currentPage, setCurrentPage] = useState(1)
  const [transactionsPerPage] = useState(10)

  useEffect(() => {
    loadWalletData()

    const pollInterval = setInterval(() => {
      if (pendingTransactions.length > 0) {
        checkPendingTransactions()
      }
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(pollInterval)
  }, [pendingTransactions.length])

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(userAgent)
    const isAndroid = /android/.test(userAgent)
    setIsMobileDevice(isIOS || isAndroid)
  }, [])

  const checkPendingTransactions = async () => {
    try {
      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
              refresh: localStorage.getItem("refresh_token"),
            }
          : null

      if (!tokens?.access) return

      const response = await fetch("/api/documents/check-pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        if (result.processed > 0) {
          console.log(`[v0] Processed ${result.processed} pending transactions`)
          // Refresh wallet data to show updated balances
          await refreshWalletData()
          onBalanceUpdate?.()
        }
      }
    } catch (error) {
      console.error("[v0] Error checking pending transactions:", error)
    }
  }

  const refreshWalletData = async () => {
    try {
      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
              refresh: localStorage.getItem("refresh_token"),
            }
          : null

      if (!tokens?.access) {
        setError("Authentication required")
        return
      }

      const headers = {
        Authorization: `Bearer ${tokens.access}`,
      }

      console.log("[v0] Refreshing wallet data...")

      const [balanceResponse, transactionsResponse] = await Promise.all([
        fetch("/api/wallet/balance", { headers }),
        fetch("/api/wallet/transactions", { headers }),
      ])

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        console.log("[v0] New balance data:", balanceData)
        console.log("[v0] Available:", balanceData.available_balance)
        console.log("[v0] Reserved:", balanceData.reserved_balance)
        console.log("[v0] Total:", balanceData.total_balance)
        setBalance(balanceData)
        console.log("[v0] Balance state set to:", balanceData)
      } else {
        console.error("[v0] Failed to load balance:", balanceResponse.status)
      }

      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json()
        console.log("[v0] Transactions count:", transactionsData.transactions?.length || 0)
        setTransactions(transactionsData.transactions || [])
        setPendingTransactions(transactionsData.pending_transactions || [])
      } else {
        console.error("[v0] Failed to load transactions:", transactionsResponse.status)
      }
    } catch (error) {
      console.error("[v0] Error refreshing wallet data:", error)
    }
  }

  const loadWalletData = async () => {
    try {
      setIsLoading(true)
      setIsBalanceLoading(true)
      setIsTransactionsLoading(true)

      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
              refresh: localStorage.getItem("refresh_token"),
            }
          : null

      if (!tokens?.access) {
        setError("Authentication required")
        return
      }

      const headers = {
        Authorization: `Bearer ${tokens.access}`,
      }

      const loadBalance = fetch("/api/wallet/balance", { headers })
        .then(async (response) => {
          if (response.ok) {
            const balanceData = await response.json()
            console.log("[v0] Balance API response:", balanceData)
            console.log("[v0] Available:", balanceData.available_balance)
            console.log("[v0] Reserved:", balanceData.reserved_balance)
            console.log("[v0] Total:", balanceData.total_balance)
            setBalance(balanceData)
            console.log("[v0] Balance state set to:", balanceData)
          } else {
            console.error("[v0] Failed to load balance:", response.status)
          }
        })
        .catch((error) => {
          console.error("[v0] Error loading balance:", error)
        })
        .finally(() => {
          setIsBalanceLoading(false)
        })

      const loadTransactions = fetch("/api/wallet/transactions", { headers })
        .then(async (response) => {
          if (response.ok) {
            const transactionsData = await response.json()
            console.log("[v0] Transactions count:", transactionsData.transactions?.length || 0)
            setTransactions(transactionsData.transactions || [])
            setPendingTransactions(transactionsData.pending_transactions || [])
          } else {
            console.error("[v0] Failed to load transactions:", response.status)
          }
        })
        .catch((error) => {
          console.error("[v0] Error loading transactions:", error)
        })
        .finally(() => {
          setIsTransactionsLoading(false)
        })

      await Promise.all([loadBalance, loadTransactions])
    } catch (error) {
      console.error("[v0] Error loading wallet data:", error)
      setError("Failed to load wallet data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTopUp = async () => {
    const amount = Number.parseFloat(topUpAmount)

    if (!amount || amount <= 0) {
      setError("Prosím zadajte platnú sumu")
      return
    }

    if (amount < 0.05) {
      setError("Minimálna suma je €0.05")
      return
    }

    if (amount > 0.5) {
      setError("Maximálna suma je €0.50")
      return
    }

    setIsTopUpLoading(true)
    setError("")
    setSuccess("")

    try {
      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
              refresh: localStorage.getItem("refresh_token"),
            }
          : null

      if (!tokens?.access) {
        setError("Authentication required")
        return
      }

      const response = await fetch("/api/wallet/top-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({
          amount: amount,
          reference: `WIRE-${Date.now()}`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process top-up")
      }

      const data = await response.json()
      setSuccess(`Úspešne pridané €${amount.toFixed(2)} do vašej peňaženky`)
      setTopUpAmount("")

      await refreshWalletData()
      onBalanceUpdate?.()
    } catch (error) {
      console.error("[v0] Top-up error:", error)
      setError(error instanceof Error ? error.message : "Failed to process top-up")
    } finally {
      setIsTopUpLoading(false)
    }
  }

  const handleMobilePayment = async () => {
    const amount = Number.parseFloat(topUpAmount)
    if (!amount || amount < 0.05 || amount > 0.5) {
      setError("Prosím zadajte platnú sumu (€0.05 - €0.50)")
      return
    }

    setError("")
    setIsMobilePaymentLoading(true)

    try {
      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
            }
          : null

      if (!tokens?.access) {
        setError("Authentication required")
        setIsMobilePaymentLoading(false)
        return
      }

      // Generate transaction ID
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

      // Construct payment link
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const day = String(now.getDate()).padStart(2, "0")
      const dueDate = `${year}${month}${day}`

      const params = new URLSearchParams({
        V: "1",
        IBAN: "SK7811000000002944276572",
        AM: amount.toFixed(2),
        CC: "EUR",
        PI: txnId,
        DT: dueDate,
        MSG: "Navýšenie kreditu",
        CN: "efabox s.r.o.",
      })

      const paymentLink = `https://payme.sk/?${params.toString()}`

      // Start listening for payment notification in background first
      listenForPaymentInBackground(txnId)

      // Navigate to payment link to trigger deep link to banking app
      window.location.href = paymentLink

      setSuccess("Otváram bankovú aplikáciu...")
    } catch (err) {
      console.error("Error generating payment link:", err)
      setError(err instanceof Error ? err.message : "Failed to generate payment link")
      setIsMobilePaymentLoading(false)
    }
  }

  const listenForPaymentInBackground = async (txnId: string) => {
    try {
      const tokens =
        typeof window !== "undefined"
          ? {
              access: localStorage.getItem("access_token"),
            }
          : null

      if (!tokens?.access) {
        setIsMobilePaymentLoading(false)
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
        console.error("Failed to subscribe to payment notifications")
        setIsMobilePaymentLoading(false)
        return
      }

      const data = await response.json()

      if (data.success && data.notification) {
        // Process payment
        const processResponse = await fetch("/api/wallet/process-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.access}`,
          },
          body: JSON.stringify({
            amount: Number.parseFloat(topUpAmount),
            transactionId: txnId,
            notification: data.notification,
          }),
        })

        if (processResponse.ok) {
          setSuccess("Platba bola úspešne prijatá!")
          setTopUpAmount("")
          await refreshWalletData()
          onBalanceUpdate?.()
          setIsMobilePaymentLoading(false)
        } else {
          setError("Nepodarilo sa spracovať platbu")
          setIsMobilePaymentLoading(false)
        }
      } else {
        setIsMobilePaymentLoading(false)
      }
    } catch (err) {
      console.error("Error listening for payment notification:", err)
      setIsMobilePaymentLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const truncateTransactionId = (description: string) => {
    // Match patterns like "QR-xxxxx" or long alphanumeric IDs
    const idPattern = /([A-Z]+-)?([a-zA-Z0-9]{8,})/g
    return description.replace(idPattern, (match, prefix, id) => {
      if (id.length > 8) {
        const first4 = id.substring(0, 4)
        const last4 = id.substring(id.length - 4)
        return `${prefix || ""}${first4}...${last4}`
      }
      return match
    })
  }

  const getTransactionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "credit":
        return <ArrowUpRight className="h-4 w-4 text-green-600" />
      case "debit":
        return <ArrowDownRight className="h-4 w-4 text-red-600" />
      default:
        return <Euro className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "succeeded":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "failed":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess("Skopirované do schránky")
    setTimeout(() => setSuccess(""), 2000)
  }

  const indexOfLastTransaction = currentPage * transactionsPerPage
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage
  const currentTransactions = transactions.slice(indexOfFirstTransaction, indexOfLastTransaction)
  const totalPages = Math.ceil(transactions.length / transactionsPerPage)

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  if (isLoading && isBalanceLoading && isTransactionsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const recentTransactions = transactions.slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Účet</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-1">
        {isBalanceLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card
              className={`overflow-hidden transition-all duration-300 ${
                balanceUpdated ? "ring-2 ring-green-500 animate-pulse" : ""
              }`}
            >
              <CardContent className="p-5 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 m-1 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">Voľné</span>
                  </div>
                  <TrendingUp className="h-3 w-3 text-green-600 opacity-50" />
                </div>
                <p className="text-2xl font-bold text-green-600 mt-1">€{animatedAvailable.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardContent className="p-5 bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/10 m-1 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-xs text-muted-foreground">Rezervované</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-yellow-600 mt-1">€{animatedReserved.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardContent className="p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 m-1 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Celkom</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600 mt-1">€{animatedTotal.toFixed(2)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 animate-in slide-in-from-top-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30 px-6 py-6 space-y-3">
          <CardTitle className="text-2xl flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold">Dobiť kredit</span>
          </CardTitle>
          <CardDescription className="text-base ml-15 text-muted-foreground">Vyberte sumu na dobíjanie</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Rýchly výber
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {[0.05, 0.1, 0.25, 0.5].map((amount) => (
                  <Button
                    key={amount}
                    variant={topUpAmount === amount.toFixed(2) ? "default" : "outline"}
                    onClick={() => setTopUpAmount(amount.toFixed(2))}
                    className="h-16 flex flex-col gap-1 hover:scale-105 transition-transform"
                    disabled={isMobilePaymentLoading}
                  >
                    <Euro className="h-4 w-4" />
                    <span className="text-lg font-bold">{amount.toFixed(2)}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Vlastná suma
              </Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                  <Euro className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="h-16 pl-16 pr-6 text-3xl font-bold text-center border-2 focus-visible:ring-4 transition-all"
                  disabled={isMobilePaymentLoading}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Min: €0.05</span>
                <span>Max: €0.50</span>
              </div>
            </div>

            <Button
              onClick={() => {
                if (isMobileDevice) {
                  handleMobilePayment()
                } else {
                  const amount = Number.parseFloat(topUpAmount)
                  if (!amount || amount < 0.05 || amount > 0.5) {
                    setError("Prosím zadajte platnú sumu (€0.05 - €0.50)")
                    return
                  }
                  setError("")
                  setShowPaymentLinkModal(true)
                }
              }}
              disabled={!topUpAmount || isMobilePaymentLoading}
              className="w-full h-14 text-lg font-bold bg-[#7dd3fc] hover:bg-[#67c3ec] text-white shadow-lg hover:shadow-xl transition-all"
            >
              {isMobilePaymentLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Spracováva sa platba...
                </>
              ) : isMobileDevice ? (
                <>
                  <Smartphone className="mr-2 h-5 w-5" />
                  Uhradiť cez mobil banking
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-5 w-5" />
                  Vygenerovať QR kód
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Prebiehajúce transakcie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTransactions.map((transaction, index) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors animate-in slide-in-from-left"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{transaction.transaction_type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">€{transaction.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="transactions" className="border-0">
            <CardHeader className="pb-3">
              <AccordionTrigger className="py-0 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Posledné transakcie
                  </CardTitle>
                  {transactions.length > 5 && (
                    <span className="text-xs text-muted-foreground">{transactions.length} transakcií</span>
                  )}
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent>
                {isTransactionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                          <div>
                            <div className="h-4 w-32 bg-muted animate-pulse rounded mb-1" />
                            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                          </div>
                        </div>
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground">Zatiaľ žiadne transakcie</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              transaction.transaction_type === "CREDIT"
                                ? "bg-green-100 dark:bg-green-900/20"
                                : "bg-red-100 dark:bg-red-900/20"
                            }`}
                          >
                            {getTransactionIcon(transaction.transaction_type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{truncateTransactionId(transaction.description)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              transaction.transaction_type === "CREDIT" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {transaction.transaction_type === "CREDIT" ? "+" : ""}€
                            {Math.abs(transaction.amount).toFixed(2)}
                          </p>
                          {transaction.balance_after !== undefined && (
                            <p className="text-xs text-muted-foreground">€{transaction.balance_after.toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Dialog open={showPaymentLinkModal} onOpenChange={setShowPaymentLinkModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <PaymentLinkView
            amount={Number.parseFloat(topUpAmount)}
            onClose={() => {
              setShowPaymentLinkModal(false)
              setTopUpAmount("")
              refreshWalletData()
              onBalanceUpdate?.()
            }}
            onPaymentSuccess={async () => {
              console.log("[v0] Payment successful, refreshing balance")
              await refreshWalletData()
              onBalanceUpdate?.()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
