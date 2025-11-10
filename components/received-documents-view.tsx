"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  RefreshCw,
  Download,
  FileText,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { AuthService } from "@/lib/auth"

interface ReceiveTransaction {
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
  results: ReceiveTransaction[]
}

interface ReceivedDocumentsViewProps {
  organizationIdentifier?: string | null
  organizations?: Array<{
    id: number
    name: string
    identifiers: Array<{
      identifier: string
      scheme: string
      verified: boolean
    }>
  }>
}

type SortField = "created_on" | "sender_identifier" | "document_id" | "state"
type SortDirection = "asc" | "desc"

export function ReceivedDocumentsView({ organizationIdentifier, organizations = [] }: ReceivedDocumentsViewProps) {
  const [transactions, setTransactions] = useState<ReceiveTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingRead, setUpdatingRead] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [pageSize, setPageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("created_on")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const fetchSenderName = async (senderIdentifier: string) => {
    if (senderNames[senderIdentifier]) return

    const tokens = AuthService.getTokens()
    if (!tokens) return

    try {
      const response = await fetch(`/api/organizations/search?identifier=${encodeURIComponent(senderIdentifier)}`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data && data.name) {
          setSenderNames((prev) => ({
            ...prev,
            [senderIdentifier]: data.name,
          }))
        }
      }
    } catch (err) {
      console.error("Failed to fetch sender name:", err)
    }
  }

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
      const offset = (page - 1) * pageSize

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
        descending: sortDirection === "desc" ? "true" : "false",
      })

      if (organizationIdentifier) {
        params.append("filter_receiver", organizationIdentifier)
      }

      if (searchQuery) {
        params.append("search", searchQuery)
      }

      if (statusFilter !== "all") {
        params.append("filter_state", statusFilter)
      }

      const response = await fetch(`/api/documents/received?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          const newTokens = await AuthService.refreshToken()
          if (newTokens) {
            const retryResponse = await fetch(`/api/documents/received?${params.toString()}`, {
              headers: {
                Authorization: `Bearer ${newTokens.access}`,
              },
            })

            if (!retryResponse.ok) {
              throw new Error("Failed to fetch received documents")
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
          throw new Error("Failed to fetch received documents")
        }
      } else {
        const data: PaginatedResponse = await response.json()
        setTransactions(data.results)
        setTotalCount(data.count)
        setHasNext(data.next !== null)
        setHasPrevious(data.previous !== null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch received documents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    fetchTransactions(1)
  }, [organizationIdentifier, pageSize, searchQuery, statusFilter, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const handleViewPDF = async (id: number) => {
    const tokens = AuthService.getTokens()
    if (!tokens) return

    try {
      const response = await fetch(`/api/documents/received/${id}/pdf`, {
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
      const response = await fetch(`/api/documents/received/${id}/document`, {
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

  const handleToggleRead = async (id: number, currentState: string) => {
    const tokens = AuthService.getTokens()
    if (!tokens) return

    setUpdatingRead(id)
    const isRead = currentState.toLowerCase() !== "new"
    const endpoint = isRead ? "mark-unread" : "mark-read"

    try {
      const response = await fetch(`/api/documents/received/${id}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        await fetchTransactions(currentPage)
      }
    } catch (err) {
      console.error("Failed to update read status:", err)
    } finally {
      setUpdatingRead(null)
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

  const isRead = (state: string) => state.toLowerCase() !== "new"

  const totalPages = Math.ceil(totalCount / pageSize)
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  const getSenderName = (senderIdentifier: string): string => {
    if (senderNames[senderIdentifier]) {
      return senderNames[senderIdentifier]
    }

    const org = organizations.find((org) => org.identifiers.some((id) => id.identifier === senderIdentifier))

    if (org) {
      return org.name
    }

    fetchSenderName(senderIdentifier)
    return senderIdentifier
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prijaté faktúry</h1>
          {organizationIdentifier && <p className="text-sm text-muted-foreground mt-1">Filtrované podľa organizácie</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => fetchTransactions(currentPage)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 py-4 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa čísla dokumentu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Stav" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všetky</SelectItem>
            <SelectItem value="new">Nové</SelectItem>
            <SelectItem value="read">Prečítané</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive" className="my-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="hidden lg:block flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted/50 border-b">
            <tr className="text-sm">
              <th className="w-12 p-3"></th>
              <th
                className="text-left p-3 cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("sender_identifier")}
              >
                <div className="flex items-center gap-2">
                  Odosielateľ
                  {sortField === "sender_identifier" &&
                    (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </div>
              </th>
              <th className="text-left p-3 cursor-pointer hover:bg-muted/80" onClick={() => handleSort("document_id")}>
                <div className="flex items-center gap-2">
                  Číslo dokumentu
                  {sortField === "document_id" &&
                    (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </div>
              </th>
              <th className="text-left p-3 cursor-pointer hover:bg-muted/80" onClick={() => handleSort("created_on")}>
                <div className="flex items-center gap-2">
                  Dátum prijatia
                  {sortField === "created_on" &&
                    (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </div>
              </th>
              <th className="text-left p-3">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Načítavam dokumenty...</p>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Žiadne prijaté dokumenty</h3>
                  <p className="text-sm text-muted-foreground">
                    {organizationIdentifier
                      ? "Žiadne dokumenty od tejto organizácie"
                      : "Dokumenty zaslané do vašej organizácie sa zobrazia tu"}
                  </p>
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const read = isRead(transaction.state)
                return (
                  <tr
                    key={transaction.id}
                    className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                      !read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleToggleRead(transaction.id, transaction.state)}
                  >
                    <td className="p-3">
                      {updatingRead === transaction.id ? (
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : read ? (
                        <MailOpen className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Mail className="h-5 w-5 text-primary" />
                      )}
                    </td>
                    <td className="p-3">
                      <div className={`font-medium ${!read ? "font-semibold" : ""}`}>
                        {getSenderName(transaction.sender_identifier)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {transaction.sender_identifier}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className={`${!read ? "font-semibold" : ""}`}>
                        {transaction.document_id || `#${transaction.id}`}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">{formatRelativeDate(transaction.created_on)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(transaction.created_on)}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewPDF(transaction.id)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadXML(transaction.id)
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden flex-1 overflow-auto space-y-2 py-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Načítavam dokumenty...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Žiadne prijaté dokumenty</h3>
            <p className="text-sm text-muted-foreground">
              {organizationIdentifier
                ? "Žiadne dokumenty od tejto organizácie"
                : "Dokumenty zaslané do vašej organizácie sa zobrazia tu"}
            </p>
          </div>
        ) : (
          transactions.map((transaction) => {
            const read = isRead(transaction.state)
            return (
              <div
                key={transaction.id}
                className={`border rounded-lg p-4 ${!read ? "bg-primary/5 border-primary/20" : "bg-card"}`}
                onClick={() => handleToggleRead(transaction.id, transaction.state)}
              >
                <div className="flex items-start gap-3 mb-3">
                  {read ? (
                    <MailOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  ) : (
                    <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${!read ? "font-semibold" : ""}`}>
                      {getSenderName(transaction.sender_identifier)}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {transaction.document_id || `#${transaction.id}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatRelativeDate(transaction.created_on)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewPDF(transaction.id)
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadXML(transaction.id)
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    XML
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            {startItem}–{endItem} z {totalCount}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!hasPrevious || loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm text-muted-foreground px-3">
              {currentPage} / {totalPages}
            </div>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNext || loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
