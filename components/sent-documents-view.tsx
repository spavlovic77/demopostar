"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Search,
  ChevronDown,
  ChevronUp,
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

type SortField = "created_on" | "receiver_identifier" | "document_id" | "state"
type SortDirection = "asc" | "desc"

export function SentDocumentsView({ organizations }: SentDocumentsViewProps) {
  const [transactions, setTransactions] = useState<SendTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [receiverNames, setReceiverNames] = useState<Record<string, string>>({})
  const [pageSize, setPageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("created_on")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

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
      const offset = (page - 1) * pageSize

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
        descending: sortDirection === "desc" ? "true" : "false",
      })

      if (searchQuery) {
        params.append("search", searchQuery)
      }

      if (statusFilter !== "all") {
        params.append("filter_state", statusFilter)
      }

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
    setCurrentPage(1)
    fetchTransactions(1)
  }, [pageSize, searchQuery, statusFilter, sortDirection])

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
      const response = await fetch(`/api/documents/sent/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice-${id}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Failed to download PDF:", err)
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
          Doručené
        </Badge>
      )
    } else if (stateLower === "failed" || stateLower === "error") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Zlyhalo
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Prebieha
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

  const totalPages = Math.ceil(totalCount / pageSize)
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className="flex flex-col h-full">
      {/* Header with title and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <h1 className="text-2xl font-semibold text-foreground">Odoslané faktúry</h1>
        <Button variant="ghost" size="sm" onClick={() => fetchTransactions(currentPage)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters toolbar */}
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
            <SelectItem value="sent">Doručené</SelectItem>
            <SelectItem value="pending">Prebieha</SelectItem>
            <SelectItem value="failed">Zlyhané</SelectItem>
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

      {/* Desktop table view */}
      <div className="hidden lg:block flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted/50 border-b">
            <tr className="text-sm">
              <th className="w-12 p-3"></th>
              <th
                className="text-left p-3 cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("receiver_identifier")}
              >
                <div className="flex items-center gap-2">
                  Príjemca
                  {sortField === "receiver_identifier" &&
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
              <th className="text-left p-3 cursor-pointer hover:bg-muted/80" onClick={() => handleSort("state")}>
                <div className="flex items-center gap-2">
                  Stav
                  {sortField === "state" &&
                    (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </div>
              </th>
              <th className="text-left p-3 cursor-pointer hover:bg-muted/80" onClick={() => handleSort("created_on")}>
                <div className="flex items-center gap-2">
                  Dátum odoslania
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
                <td colSpan={6} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Načítavam dokumenty...</p>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Send className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Žiadne odoslané dokumenty</h3>
                  <p className="text-sm text-muted-foreground">Dokumenty, ktoré odošlete, sa zobrazia tu</p>
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-3">
                    <Send className="h-5 w-5 text-muted-foreground" />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">
                      {receiverNames[transaction.receiver_identifier] || transaction.receiver_identifier}
                    </div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {transaction.receiver_identifier}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{transaction.document_id || `#${transaction.id}`}</div>
                  </td>
                  <td className="p-3">{getStatusBadge(transaction.state)}</td>
                  <td className="p-3">
                    <div className="text-sm">{formatRelativeDate(transaction.created_on)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(transaction.created_on)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewPDF(transaction.id)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadXML(transaction.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden flex-1 overflow-auto space-y-2 py-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Načítavam dokumenty...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Send className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Žiadne odoslané dokumenty</h3>
            <p className="text-sm text-muted-foreground">Dokumenty, ktoré odošlete, sa zobrazia tu</p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-start gap-3 mb-3">
                <Send className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {receiverNames[transaction.receiver_identifier] || transaction.receiver_identifier}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {transaction.document_id || `#${transaction.id}`}
                  </div>
                  <div className="mt-2">{getStatusBadge(transaction.state)}</div>
                  <div className="text-xs text-muted-foreground mt-2">{formatRelativeDate(transaction.created_on)}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => handleViewPDF(transaction.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => handleDownloadXML(transaction.id)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  XML
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination footer */}
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
