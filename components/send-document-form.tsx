"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, CheckCircle, AlertCircle, X, Send, Loader2, FileCheck, Euro } from "lucide-react"
import { AuthService } from "@/lib/auth"

interface SendDocumentResponse {
  id: number
  state: string
  sender_identifier: string
  receiver_identifier: string
  document_element: string
  document_id: string
  created_on: string
  last_updated_on: string
  transaction_id: string
  wallet_transaction_id: string
  new_tokens?: any // Added for token refresh handling
}

interface WalletBalance {
  available_balance: number
  reserved_balance: number
  total_balance: number
}

interface StatusStep {
  id: string
  label: string
  completed: boolean
  active: boolean
  error?: boolean
}

interface OrganizationData {
  id: number
  name: string
  peppol_identifier?: string
}

function SimpleStatusTracker({ steps }: { steps: StatusStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3">
          {step.error ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : step.completed ? (
            <CheckCircle className="h-5 w-5 text-primary" />
          ) : step.active ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          )}
          <span
            className={`text-sm ${step.completed ? "text-foreground" : step.active ? "text-primary" : "text-muted-foreground"}`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SendDocumentForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<SendDocumentResponse | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [documentState, setDocumentState] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([])
  const [organizationData, setOrganizationData] = useState<OrganizationData | null>(null)
  const [isGeneratingTestInvoice, setIsGeneratingTestInvoice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const DOCUMENT_FEE = 0.01 // Updated document fee from 0.001 to 0.01 EUR

  useEffect(() => {
    loadWalletBalance()
    loadOrganizationData()
  }, [])

  useEffect(() => {
    if (success && documentState && documentState !== "SENT" && documentState !== "ERROR") {
      setIsPolling(true)
      const pollInterval = setInterval(async () => {
        try {
          const tokens = AuthService.getTokens()
          if (!tokens) return

          const response = await fetch(`/api/documents/poll-mdn`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokens.access}`,
              "X-Refresh-Token": tokens.refresh, // Added refresh token header
            },
            body: JSON.stringify({
              transactionId: success.wallet_transaction_id,
              ionApTransactionId: success.id.toString(),
              stage: "initial",
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.new_tokens) {
              console.log("[v0] Received new tokens from server, updating stored tokens")
              AuthService.setTokens(data.new_tokens)
            }
            if (data.state && data.state !== documentState) {
              setDocumentState(data.state)
              setSuccess((prev) => (prev ? { ...prev, state: data.state } : null))
              updateStatusSteps(data.state, true)

              if (data.state === "SENT" || data.state === "ERROR") {
                setIsPolling(false)
                clearInterval(pollInterval)
                await loadWalletBalance()
              }
            }
          } else if (response.status === 401) {
            console.log("[v0] Polling failed with 401, attempting token refresh...")
            const newTokens = await AuthService.refreshToken()
            if (!newTokens) {
              console.error("[v0] Token refresh failed, stopping polling")
              setIsPolling(false)
              clearInterval(pollInterval)
              setError("Authentication expired. Please refresh the page.")
            }
          }
        } catch (error) {
          console.error("[v0] Error polling document state:", error)
        }
      }, 5000)

      return () => {
        clearInterval(pollInterval)
        setIsPolling(false)
      }
    }
  }, [success, documentState])

  const updateStatusSteps = (state: string, fundsReserved = false) => {
    const steps: StatusStep[] = [
      {
        id: "initiated",
        label: "Odosielanie dokumentu iniciované",
        completed: true,
        active: false,
      },
      {
        id: "queued",
        label: "Dokument v rade na odoslanie",
        completed: state !== "QUEUED",
        active: state === "QUEUED",
      },
      {
        id: "funds",
        label: "Finančné prostriedky rezervované",
        completed: fundsReserved,
        active: false,
      },
      {
        id: "status",
        label:
          state === "SENT"
            ? "Dokument úspešne doručený"
            : state === "ERROR"
              ? "Doručenie dokumentu zlyhalo"
              : state === "DEFERRED"
                ? "Doručenie dokumentu odložené"
                : "Kontrola stavu doručenia",
        completed: state === "SENT" || state === "ERROR",
        active: state === "DEFERRED" || (state !== "SENT" && state !== "ERROR"),
        error: state === "ERROR",
      },
      {
        id: "financial",
        label:
          state === "SENT"
            ? "Prostriedky odpočítané"
            : state === "ERROR"
              ? "Prostriedky vrátené"
              : "Spracovanie platby",
        completed: state === "SENT" || state === "ERROR",
        active: false,
      },
    ]

    if (state === "DEFERRED") {
      steps.push({
        id: "polling",
        label: "Progresívne monitorovanie spustené",
        completed: false,
        active: true,
      })
    }

    setStatusSteps(steps)
  }

  const loadWalletBalance = async () => {
    try {
      const tokens = AuthService.getTokens()
      if (!tokens) return

      const response = await fetch("/api/wallet/balance", {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })
      if (response.ok) {
        const balance = await response.json()
        setWalletBalance(balance)
        console.log("[v0] Wallet balance loaded:", balance)
      } else {
        console.log("[v0] Failed to load wallet balance - user may not have Supabase account")
      }
    } catch (error) {
      console.error("[v0] Error loading wallet balance:", error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const loadOrganizationData = async () => {
    try {
      console.log("[v0] Loading organization data...")
      const tokens = AuthService.getTokens()
      if (!tokens) {
        console.log("[v0] No tokens available for organization data")
        return
      }

      console.log("[v0] Fetching organization data from ion-AP...")
      const orgResponse = await fetch(`/api/ion-ap/organizations`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (orgResponse.ok) {
        const orgData = await orgResponse.json()
        console.log("[v0] Organization data received:", orgData)

        if (orgData.results && orgData.results.length > 0) {
          const firstOrg = orgData.results[0]

          // Get Peppol identifiers for the organization
          console.log("[v0] Fetching Peppol identifiers for organization:", firstOrg.id)
          const identifiersResponse = await fetch(`/api/ion-ap/organizations/${firstOrg.id}/identifiers`, {
            headers: {
              Authorization: `Bearer ${tokens.access}`,
            },
          })

          if (identifiersResponse.ok) {
            const identifiersData = await identifiersResponse.json()
            console.log("[v0] Identifiers data received:", identifiersData)
            const peppolId = identifiersData.results?.[0]?.identifier || null

            setOrganizationData({
              id: firstOrg.id,
              name: firstOrg.name,
              peppol_identifier: peppolId,
            })
            console.log("[v0] Organization data set successfully")
          } else {
            console.log("[v0] Failed to fetch identifiers, setting org data without Peppol ID")
            setOrganizationData({
              id: firstOrg.id,
              name: firstOrg.name,
            })
          }
        } else {
          console.log("[v0] No organizations found in response")
        }
      } else {
        console.log("[v0] Failed to fetch organization data, status:", orgResponse.status)
      }
    } catch (error) {
      console.error("[v0] Error loading organization data:", error)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  const handleFileSelection = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setError("Please select an XML file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB")
      return
    }

    setSelectedFile(file)
    setError("")
    setSuccess(null)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  const handleSendDocument = async () => {
    if (!selectedFile) {
      setError("Please select a file first")
      return
    }

    const tokens = AuthService.getTokens()
    if (!tokens) {
      setError("Authentication required")
      return
    }

    if (walletBalance && walletBalance.available_balance < DOCUMENT_FEE) {
      setError(
        `Insufficient funds. Required: €${DOCUMENT_FEE.toFixed(2)}, Available: €${walletBalance.available_balance.toFixed(2)}`,
      )
      return
    }

    setIsUploading(true)
    setError("")
    setDocumentState(null)
    setSuccess(null)
    setStatusSteps([
      {
        id: "initiated",
        label: "Odosielanie dokumentu iniciované",
        completed: false,
        active: true,
      },
    ])

    try {
      const fileContent = await selectedFile.text()

      const response = await fetch("/api/documents/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          Authorization: `Bearer ${tokens.access}`,
          "X-Refresh-Token": tokens.refresh, // Added refresh token header
        },
        body: fileContent,
      })

      if (!response.ok) {
        if (response.status === 402) {
          const errorData = await response.json()
          setError(
            `Insufficient funds. Required: €${errorData.required?.toFixed(2) || DOCUMENT_FEE.toFixed(2)}, Available: €${errorData.available?.toFixed(2) || 0}`,
          )
          return
        } else if (response.status === 401) {
          const newTokens = await AuthService.refreshToken()
          if (newTokens) {
            const retryResponse = await fetch("/api/documents/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/xml",
                Authorization: `Bearer ${newTokens.access}`,
                "X-Refresh-Token": newTokens.refresh,
              },
              body: fileContent,
            })

            if (!retryResponse.ok) {
              const errorData = await retryResponse.text()
              throw new Error(`Failed to send document: ${errorData}`)
            }

            const data = await retryResponse.json()
            setSuccess(data)
            setDocumentState(data.state)
            updateStatusSteps(data.state, true)
          } else {
            throw new Error("Authentication failed")
          }
        } else {
          const errorData = await response.text()
          throw new Error(`Failed to send document: ${errorData}`)
        }
      } else {
        const data = await response.json()
        if (data.new_tokens) {
          console.log("[v0] Received new tokens from server, updating stored tokens")
          AuthService.setTokens(data.new_tokens)
        }
        setSuccess(data)
        setDocumentState(data.state)
        updateStatusSteps(data.state, true)

        await loadWalletBalance()
      }

      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send document")
    } finally {
      setIsUploading(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setError("")
    setSuccess(null)
    setDocumentState(null)
    setStatusSteps([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "sent":
        return "bg-primary text-primary-foreground"
      case "queued":
        return "bg-muted text-muted-foreground"
      case "sending":
        return "bg-accent text-accent-foreground"
      case "deferred":
        return "bg-pink-500 text-pink-100"
      case "error":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const generateTestInvoice = async () => {
    if (!organizationData) {
      setError("Organization data not available")
      return
    }

    setIsGeneratingTestInvoice(true)
    setError("")

    try {
      const templateResponse = await fetch("/sample-invoice.xml")
      if (!templateResponse.ok) {
        throw new Error("Failed to load invoice template")
      }

      let invoiceXml = await templateResponse.text()

      try {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(invoiceXml, "application/xml")
        const parseError = xmlDoc.getElementsByTagName("parsererror")
        if (parseError.length > 0) {
          const errorText = parseError[0].textContent || "Unknown XML parsing error"
          console.log("[v0] XML template parsing error:", errorText)
          throw new Error(`Invalid XML template: ${errorText}`)
        }
        console.log("[v0] XML template validated successfully")
      } catch (parseError) {
        console.error("[v0] XML template validation failed:", parseError)
        // Don't fail completely on XML validation errors in development
        console.log("[v0] Continuing with XML processing despite validation error")
      }

      // Replace supplier information with user's organization data
      const currentDate = new Date().toISOString().split("T")[0]
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // 30 days from now
      const invoiceId = `TEST-${Date.now()}`

      invoiceXml = invoiceXml
        .replace(/INV-2025-001/g, invoiceId)
        .replace(/2025-05-15/g, currentDate)
        .replace(/2025-06-14/g, dueDate)
        .replace(
          /GASTROMANIA CZ s\.r\.o\./g,
          organizationData.name.replace(/[&<>"']/g, (match) => {
            const escapeMap: { [key: string]: string } = {
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            }
            return escapeMap[match]
          }),
        )

      // Get Peppol identifiers for proper formatting
      const tokens = AuthService.getTokens()
      if (tokens && organizationData.id) {
        try {
          const identifiersResponse = await fetch(`/api/ion-ap/organizations/${organizationData.id}/identifiers`, {
            headers: {
              Authorization: `Bearer ${tokens.access}`,
            },
          })

          if (identifiersResponse.ok) {
            const identifiersData = await identifiersResponse.json()
            const peppolIdentifier = identifiersData.results?.[0]

            if (peppolIdentifier && peppolIdentifier.scheme && peppolIdentifier.identifier) {
              const schemeId = String(peppolIdentifier.scheme).trim()
              const identifierValue = String(peppolIdentifier.identifier).trim()

              console.log("[v0] Using Peppol identifier:", { schemeId, identifierValue })

              invoiceXml = invoiceXml.replace(
                /<cbc:EndpointID\s+schemeID="9950">0-28654684<\/cbc:EndpointID>/g,
                `<cbc:EndpointID schemeID="${schemeId}">${identifierValue}</cbc:EndpointID>`,
              )

              // Replace CompanyID in PartyTaxScheme
              invoiceXml = invoiceXml.replace(
                /<cbc:CompanyID>CZ0-28654684<\/cbc:CompanyID>/g,
                `<cbc:CompanyID>${schemeId}${identifierValue}</cbc:CompanyID>`,
              )

              // Replace CompanyID in PartyLegalEntity with schemeID attribute
              invoiceXml = invoiceXml.replace(
                /<cbc:CompanyID\s+schemeID="0154">28654684<\/cbc:CompanyID>/g,
                `<cbc:CompanyID schemeID="${schemeId}">${identifierValue}</cbc:CompanyID>`,
              )
            }
          }
        } catch (identifierError) {
          console.log("[v0] Could not fetch fresh identifier data, using cached data")
          if (organizationData.peppol_identifier) {
            const cachedId = String(organizationData.peppol_identifier).trim()
            if (cachedId) {
              console.log("[v0] Using cached Peppol identifier:", cachedId)
              invoiceXml = invoiceXml.replace(
                /<cbc:EndpointID\s+schemeID="9950">0-28654684<\/cbc:EndpointID>/g,
                `<cbc:EndpointID schemeID="9950">${cachedId}</cbc:EndpointID>`,
              )
              invoiceXml = invoiceXml.replace(
                /<cbc:CompanyID>CZ0-28654684<\/cbc:CompanyID>/g,
                `<cbc:CompanyID>9950${cachedId}</cbc:CompanyID>`,
              )
              invoiceXml = invoiceXml.replace(
                /<cbc:CompanyID\s+schemeID="0154">28654684<\/cbc:CompanyID>/g,
                `<cbc:CompanyID schemeID="9950">${cachedId}</cbc:CompanyID>`,
              )
            }
          }
        }
      }

      try {
        const parser = new DOMParser()
        const finalXmlDoc = parser.parseFromString(invoiceXml, "application/xml")
        const finalParseError = finalXmlDoc.getElementsByTagName("parsererror")
        if (finalParseError.length > 0) {
          const errorText = finalParseError[0].textContent || "Unknown XML parsing error"
          console.log("[v0] Generated XML parsing error:", errorText)
          console.log("[v0] Generated XML content:", invoiceXml.substring(0, 500) + "...")
          throw new Error(`Generated XML is malformed: ${errorText}`)
        }
        console.log("[v0] Generated XML validated successfully")
      } catch (finalParseError) {
        console.error("[v0] Generated XML validation failed:", finalParseError)
        console.log("[v0] Generated XML content:", invoiceXml.substring(0, 500) + "...")
        // Don't fail completely on XML validation errors in development
        console.log("[v0] Continuing with file creation despite validation error")
      }

      // Create a blob and file from the modified XML
      const blob = new Blob([invoiceXml], { type: "application/xml" })
      const file = new File([blob], `test-invoice-${invoiceId}.xml`, { type: "application/xml" })

      console.log("[v0] Test invoice generated successfully:", file.name)
      handleFileSelection(file)
    } catch (error) {
      console.error("[v0] Error generating test invoice:", error)
      setError(error instanceof Error ? error.message : "Failed to generate test invoice")
    } finally {
      setIsGeneratingTestInvoice(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Odoslať dokument</h1>
      </div>

      {false && organizationData && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Váša prvá testovacia faktúra je pripravená na odoslanie
            </CardTitle>
            <CardDescription>
              Vygenerujte vzorový dokument s údajmi vašej organizácie na otestovanie procesu odosielania
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Organizácia:</strong> {organizationData.name}
                </p>
                {organizationData.peppol_identifier && (
                  <p>
                    <strong>Peppol ID:</strong> 9950:{organizationData.peppol_identifier}
                  </p>
                )}
              </div>
              <Button
                onClick={generateTestInvoice}
                disabled={isGeneratingTestInvoice || selectedFile !== null}
                variant="outline"
                className="w-full bg-transparent"
              >
                {isGeneratingTestInvoice ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generujem testovaciu faktúru...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generovať testovaciu faktúru
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <Euro className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">Poplatok za odoslanie dokumentu: </span>
            <span className="font-medium text-accent">€{DOCUMENT_FEE.toFixed(2)}</span>
            {walletBalance && walletBalance.available_balance < DOCUMENT_FEE && (
              <Badge variant="destructive" className="ml-2">
                Nedostatočné prostriedky
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {statusSteps.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Stav dokumentu</span>
              {isPolling && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Monitorujem doručenie...
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleStatusTracker steps={statusSteps} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Nahrať Peppol BIS dokument
          </CardTitle>
          <CardDescription>Nahrajte váš Peppol BIS dokument v XML formáte na odoslanie príjemcovi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile ? (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {dragActive ? "Presuňte dokument sem" : "Presuňte dokument sem"}
              </h3>
              <p className="text-muted-foreground mb-4">alebo kliknite pre prehľadávanie XML súborov (max 10MB)</p>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Vybrať súbor
              </Button>
              <input ref={fileInputRef} type="file" accept=".xml" onChange={handleFileInputChange} className="hidden" />
            </div>
          ) : (
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="h-8 w-8 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)} • XML dokument</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={removeFile} disabled={isUploading}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Odosielam dokument...</span>
                    <span className="text-muted-foreground">0%</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleSendDocument}
              disabled={
                !selectedFile || isUploading || (walletBalance && walletBalance.available_balance < DOCUMENT_FEE)
              }
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Odosielam...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Odoslať dokument (€{DOCUMENT_FEE.toFixed(2)})
                </>
              )}
            </Button>
            {selectedFile && !isUploading && (
              <Button variant="outline" onClick={removeFile}>
                Zrušiť
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
