"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  FileText,
  Mail,
  MailOpen,
  Filter,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ReceivedDocument {
  id: number
  sender_identifier: string
  receiver_identifier: string
  document_id: string
  document_type: string
  state: string
  created_on: string
  read: boolean
  sender_name?: string
}

interface PaginationData {
  count: number
  next: string | null
  previous: string | null
  results: ReceivedDocument[]
}

export function ReceivedDocumentsInbox() {
  const [documents, setDocuments] = useState<ReceivedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterState, setFilterState] = useState("all")
  const [filterOrg, setFilterOrg] = useState("all")
  const [sortBy, setSortBy] = useState("created_on")
  const [sortDesc, setSortDesc] = useState(true)
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadDocuments()
  }, [currentPage, pageSize, searchQuery, filterState, filterOrg, sortBy, sortDesc])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("jwt_token")
      const offset = (currentPage - 1) * pageSize

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
        order_by: sortBy,
        descending: sortDesc.toString(),
      })

      if (searchQuery) {
        params.append("filter_document_identifier", searchQuery)
      }
      if (filterState !== "all") {
        params.append("filter_state", filterState)
      }
      if (filterOrg !== "all") {
        params.append("filter_receiver", filterOrg)
      }

      const response = await fetch(`/api/documents/received?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data: PaginationData = await response.json()
        setDocuments(data.results)
        setTotalCount(data.count)
      }
    } catch (error) {
      console.error("Error loading documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleReadStatus = async (docId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem("jwt_token")
      const endpoint = currentStatus
        ? `/api/documents/received/${docId}/mark-unread`
        : `/api/documents/received/${docId}/mark-read`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        loadDocuments()
      }
    } catch (error) {
      console.error("Error toggling read status:", error)
    }
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Dnes"
    if (diffDays === 1) return "Včera"
    if (diffDays === 2) return "Pred 2 dňami"
    if (diffDays < 7) return `Pred ${diffDays} dňami`
    if (diffDays < 14) return "Pred týždňom"
    if (diffDays < 30) return `Pred ${Math.floor(diffDays / 7)} týždňami`
    if (diffDays < 60) return "Pred mesiacom"
    return date.toLocaleDateString("sk-SK")
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header - Email style */}
      <div className="border-b bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Prijaté dokumenty</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{totalCount} dokumentov</span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Hľadať číslo dokumentu..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Select
              value={filterState}
              onValueChange={(value) => {
                setFilterState(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Stav" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky stavy</SelectItem>
                <SelectItem value="delivered">Doručené</SelectItem>
                <SelectItem value="processing">Spracúva sa</SelectItem>
                <SelectItem value="error">Chyba</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Zoradiť" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_on">Podľa dátumu</SelectItem>
                <SelectItem value="sender_identifier">Podľa odosielateľa</SelectItem>
                <SelectItem value="document_id">Podľa čísla</SelectItem>
                <SelectItem value="state">Podľa stavu</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortDesc(!sortDesc)}
              title={sortDesc ? "Zostupne" : "Vzostupne"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Document List - Email style table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[200px]">Odosielateľ</TableHead>
              <TableHead className="flex-1">Dokument</TableHead>
              <TableHead className="w-[120px]">Stav</TableHead>
              <TableHead className="w-[140px]">Dátum</TableHead>
              <TableHead className="w-[100px] text-right">Akcie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Načítavam...
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Žiadne dokumenty
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    !doc.read && "bg-blue-50/50 font-medium dark:bg-blue-950/20",
                  )}
                  onClick={() => toggleReadStatus(doc.id, doc.read)}
                >
                  <TableCell>
                    {doc.read ? (
                      <MailOpen className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="truncate" title={doc.sender_identifier}>
                      {doc.sender_name || doc.sender_identifier}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{doc.document_id}</span>
                      <span className="text-xs text-muted-foreground">{doc.document_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", getStateColor(doc.state))}>{doc.state}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatRelativeDate(doc.created_on)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`/api/documents/received/${doc.id}/pdf`, "_blank")
                        }}
                        title="Stiahnuť PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`/api/documents/received/${doc.id}/document`, "_blank")
                        }}
                        title="Stiahnuť XML"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="border-t bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Zobrazených {Math.min((currentPage - 1) * pageSize + 1, totalCount)}-
              {Math.min(currentPage * pageSize, totalCount)} z {totalCount}
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[100px]">
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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Strana {currentPage} z {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
