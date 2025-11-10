"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Download,
  FileText,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { AuthService } from "@/lib/auth"

interface SendTransaction {
  id: number
  transaction_identifier: string
  sender_identifier: string
  receiver_identifier: string
  document_element: string
  document_id: string
  state: string
  created_on: string
  updated_on: string
}

interface PaginatedResponse {
  count: number
  next: string | null
  previous: string | null
  results: SendTransaction[]
}

interface Organization {
  id: number
  name: string
  identifiers: Array<{
    identifier: string
    scheme: string
    verified: boolean
  }>
}

interface SentDocumentsViewProps {
  organizations: Organization[]
}

export function SentDocumentsView({ organizations }: SentDocumentsViewProps) {
  const [transactions, setTransactions] = useState<SendTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const itemsPerPage = 10
  const [receiverNames, setReceiverNames] = useState<Record<string, string>>({})

  const getReceiverName = async (receiverIdentifier: string): Promise<string> => {
    if (receiverNames[receiverIdentifier]) {
      return receiverNames[receiverIdentifier]
    }

    const localOrg = organizations.find((org) => org.identifiers.some((id) => id.identifier === receiverIdentifier))

    if (localOrg) {
      setReceiverNames((prev) => ({ ...prev, [receiverIdentifier]: localOrg.name }))
      return localOrg.name
    }

    try {
      const tokens = AuthService.getTokens()
      if (!tokens) return receiverIdentifier

      const response = await fetch(`/api/organizations/search?identifier=${encodeURIComponent(receiverIdentifier)}`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const org = await response.json()
        if (org && org.name) {
          setReceiverNames((prev) => ({ ...prev, [receiverIdentifier]: org.name }))
          return org.name
        }
      }
    } catch (error) {
      console.error("Failed to fetch receiver name:", error)
    }

    return receiverIdentifier
  }

  useEffect(() => {
    const loadReceiverNames = async () => {
      for (const transaction of transactions) {
        if (!receiverNames[transaction.receiver_identifier]) {
          await getReceiverName(transaction.receiver_identifier)
        }
      }
    }

    if (transactions.length > 0) {
      loadReceiverNames()
    }
  }, [transactions])

  const fetchTransactions = async (page = 1) => {
    setLoading(true)
    setError("")

    const tokens = AuthService.getTokens()
    if (!tokens) {
      setError("Authentication required")
      setLoading(false)
      return
    }

    try {
      const offset = (page - 1) * itemsPerPage

      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: offset.toString(),
        descending: "true",
      })

      const response = await fetch(`/api/documents/sent?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          const newTokens = await AuthService.refreshToken()
          if (newTokens) {
            const retryResponse = await fetch(`/api/documents/sent?${params.toString()}`, {
              headers: {
                Authorization: `Bearer ${newTokens.access}`,
              },
            })

            if (!retryResponse.ok) {
              throw new Error("Failed to fetch sent documents")
            }

            const data: PaginatedResponse = await retryResponse.json()
            setTransactions(data.results)
            setTotalCount(data.count)
            setHasNext(data.next !== null)
            setHasPrevious(data.previous !== null)
          } else {
            throw new Error("Authentication failed")
          }
        } else {
          throw new Error("Failed to fetch sent documents")
        }
      } else {
        const data: PaginatedResponse = await response.json()
        setTransactions(data.results)
        setTotalCount(data.count)
        setHasNext(data.next !== null)
        setHasPrevious(data.previous !== null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sent documents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions(1)
  }, [])

  const handleViewPDF = async (id: number) => {
    const tokens = AuthService.getTokens()
    if (!tokens) return

    try {
      const response = await fetch(`/api/documents/sent/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        window.open(url, "_blank")
      }
    } catch (err) {
      console.error("Failed to view PDF:", err)
    }
  }

  const handleDownloadXML = async (id: number) => {
    const tokens = AuthService.getTokens()
    if (!tokens) return

    try {
      const response = await fetch(`/api/documents/sent/${id}/document`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `document-${id}.xml`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Failed to download XML:", err)
    }
  }

  const handleViewReceipt = async (id: number) => {
    const tokens = AuthService.getTokens()
    if (!tokens) return

    try {
      const response = await fetch(`/api/documents/sent/${id}/receipt`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `receipt-${id}.xml`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Failed to view receipt:", err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Dnes"
    if (diffDays === 1) return "Včera"
    if (diffDays === 2) return "Pred 2 dňami"
    if (diffDays < 7) return `Pred ${diffDays} dňami`
    if (diffDays < 14) return "Pred týždňom"
    if (diffDays < 30) return `Pred ${Math.floor(diffDays / 7)} týždňami`
    if (diffDays < 60) return "Pred mesiacom"
    return `Pred ${Math.floor(diffDays / 30)} mesiacmi`
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (state: string) => {
    const stateLower = state.toLowerCase()
    if (stateLower === "sent" || stateLower === "delivered" || stateLower === "completed") {
      return (
        <Badge
          variant="secondary"
          className="flex items-center gap-1 bg-green-500/10 text-green-700 dark:text-green-400"
        >
          <CheckCircle className="h-3 w-3" />
          <span className="hidden sm:inline">Doručené</span>
        </Badge>
      )
    } else if (stateLower === "failed" || stateLower === "error") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span className="hidden sm:inline">Zlyhalo</span>
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="hidden sm:inline">Prebieha</span>
        </Badge>
      )
    }
  }

  const handleNextPage = () => {
    if (hasNext) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchTransactions(nextPage)
    }
  }

  const handlePreviousPage = () => {
    if (hasPrevious) {
      const prevPage = currentPage - 1
      setCurrentPage(prevPage)
      fetchTransactions(prevPage)
    }
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalCount)

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Odoslané faktúry</h1>
        <Button variant="outline" size="sm" onClick={() => fetchTransactions(currentPage)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Obnoviť</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12 lg:py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm lg:text-base text-muted-foreground">Načítavam dokumenty...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 lg:py-16">
          <Send className="mx-auto h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground mb-4" />
          <h3 className="text-base lg:text-lg font-medium text-foreground mb-2">Žiadne odoslané dokumenty</h3>
          <p className="text-sm text-muted-foreground">Dokumenty, ktoré odošlete, sa zobrazia tu</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 lg:space-y-4">
            {transactions.map((transaction) => {
              const stateLower = transaction.state.toLowerCase()
              const isDelivered = stateLower === "sent" || stateLower === "delivered" || stateLower === "completed"
              const isFailed = stateLower === "failed" || stateLower === "error"

              return (
                <div
                  key={transaction.id}
                  className={`
                    group relative rounded-lg border transition-all hover:shadow-md
                    ${isDelivered ? "bg-card" : isFailed ? "bg-destructive/5 border-destructive/20" : "bg-card"}
                  `}
                >
                  <div className="p-4 lg:p-6">
                    <div className="flex items-start justify-between gap-4 mb-3 lg:mb-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-1">
                          <Send className="h-5 w-5 lg:h-6 lg:w-6 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base lg:text-lg text-foreground truncate">
                            {receiverNames[transaction.receiver_identifier] || transaction.receiver_identifier}
                          </h3>
                          <p className="text-xs lg:text-sm text-muted-foreground truncate">
                            {transaction.document_id || `Transakcia #${transaction.id}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm lg:text-base font-medium text-foreground">
                          {formatRelativeDate(transaction.created_on)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatTime(transaction.created_on)}</p>
                      </div>
                    </div>

                    <div className="mb-3">{getStatusBadge(transaction.state)}</div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPDF(transaction.id)}
                        className="flex-1 sm:flex-none"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Zobraziť PDF</span>
                        <span className="sm:hidden">PDF</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadXML(transaction.id)}
                        className="flex-1 sm:flex-none"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        XML
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewReceipt(transaction.id)}
                        className="flex-1 sm:flex-none"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Potvrdenie</span>
                        <span className="sm:hidden">MDN</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {totalCount > itemsPerPage && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="text-xs lg:text-sm text-muted-foreground text-center sm:text-left">
                Zobrazujem {startItem} až {endItem} z {totalCount} dokumentov
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!hasPrevious || loading}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Predošlá</span>
                </Button>
                <div className="text-xs lg:text-sm text-muted-foreground px-2">
                  Strana {currentPage} z {totalPages}
                </div>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNext || loading}>
                  <span className="hidden sm:inline">Ďalšia</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
