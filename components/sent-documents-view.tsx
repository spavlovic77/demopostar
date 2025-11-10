"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

  const getStatusBadge = (state: string) => {
    const stateLower = state.toLowerCase()
    if (stateLower === "sent" || stateLower === "delivered" || stateLower === "completed") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Delivered
        </Badge>
      )
    } else if (stateLower === "failed" || stateLower === "error") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Sent</h1>
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
          <Send className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No documents sent</h3>
          <p className="text-muted-foreground">Documents you send will be tracked here</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Sent date</TableHead>
                  <TableHead>PDF version</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {receiverNames[transaction.receiver_identifier] || transaction.receiver_identifier}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.document_id || `Transaction #${transaction.id}`}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(transaction.created_on)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleViewPDF(transaction.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View PDF
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadXML(transaction.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        XML
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(transaction.state)}
                        <Button variant="ghost" size="sm" onClick={() => handleViewReceipt(transaction.id)}>
                          <Download className="h-4 w-4 mr-2" />
                          Receipt
                        </Button>
                      </div>
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
