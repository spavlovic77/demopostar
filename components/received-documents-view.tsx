"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RefreshCw, Download, FileText, Mail, MailOpen, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react"
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
  const itemsPerPage = 10

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

    console.log("[v0] Fetching transactions for organizationIdentifier:", organizationIdentifier)

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

      if (organizationIdentifier) {
        params.append("filter_receiver", organizationIdentifier)
        console.log("[v0] Added filter_receiver:", organizationIdentifier)
      }

      console.log("[v0] API URL:", `/api/documents/received?${params.toString()}`)

      const response = await fetch(`/api/documents/received?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      console.log("[v0] Response status:", response.status)

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
    console.log("[v0] organizationIdentifier changed to:", organizationIdentifier)
    setCurrentPage(1)
    fetchTransactions(1)
  }, [organizationIdentifier])

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return "Today"
    } else if (diffDays === 1) {
      return "Yesterday"
    } else if (diffDays === 2) {
      return "Two days ago"
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else if (diffDays < 14) {
      return "One week ago"
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return weeks === 1 ? "One week ago" : `${weeks} weeks ago`
    } else if (diffDays < 60) {
      return "One month ago"
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} months ago`
    } else {
      const years = Math.floor(diffDays / 365)
      return years === 1 ? "One year ago" : `${years} years ago`
    }
  }

  const isRead = (state: string) => state.toLowerCase() !== "new"

  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalCount)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Received</h1>
          {organizationIdentifier && <p className="text-sm text-muted-foreground mt-1">Filtered by organization</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTransactions(currentPage)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No documents received</h3>
          <p className="text-muted-foreground">
            {organizationIdentifier
              ? "No documents from this organization"
              : "Documents sent to your organization will appear here"}
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Received date</TableHead>
                  <TableHead>PDF version</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow
                    key={transaction.id}
                    className={`cursor-pointer transition-colors ${
                      isRead(transaction.state) ? "hover:bg-muted/50" : "bg-muted/50 hover:bg-muted"
                    }`}
                    onClick={() => handleViewPDF(transaction.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isRead(transaction.state) ? (
                          <MailOpen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Mail className="h-4 w-4 text-primary" />
                        )}
                        <div>
                          <div className="font-medium">{getSenderName(transaction.sender_identifier)}</div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.document_id || `Transaction #${transaction.id}`}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{formatRelativeDate(transaction.created_on)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(transaction.created_on)}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleViewPDF(transaction.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View PDF
                      </Button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadXML(transaction.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        XML
                      </Button>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isRead(transaction.state) ? (
                            <DropdownMenuItem
                              onClick={() => handleToggleRead(transaction.id, transaction.state)}
                              disabled={updatingRead === transaction.id}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Mark as Unread
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleToggleRead(transaction.id, transaction.state)}
                              disabled={updatingRead === transaction.id}
                            >
                              <MailOpen className="h-4 w-4 mr-2" />
                              Mark as Read
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalCount > itemsPerPage && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startItem} to {endItem} of {totalCount} documents
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!hasPrevious || loading}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNext || loading}>
                  Next
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
