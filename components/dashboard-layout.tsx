"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Send,
  Inbox,
  Archive,
  User,
  LogOut,
  FileText,
  Menu,
  X,
  Wallet,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { SendDocumentForm } from "@/components/send-document-form"
import { ReceivedDocumentsView } from "@/components/received-documents-view"
import { SentDocumentsView } from "@/components/sent-documents-view"
import { UserProfileManagement } from "@/components/user-profile-management"
import { WalletManagement } from "@/components/wallet-management"
import { useAppContext } from "@/lib/app-context"

interface DashboardStats {
  totalSent: number
  totalReceived: number
  pendingSent: number
  failedSent: number
}

interface WalletBalance {
  available: number
  reserved: number
  total: number
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

export function DashboardLayout() {
  const { userData, walletBalance, organizations, isLoading, walletLoading, refreshWalletBalance } = useAppContext()

  const [activeSection, setActiveSection] = useState("send")
  const [selectedOrganizationIdentifier, setSelectedOrganizationIdentifier] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalSent: 0,
    totalReceived: 0,
    pendingSent: 0,
    failedSent: 0,
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [foldersExpanded, setFoldersExpanded] = useState(true)

  const handleLogout = () => {
    AuthService.logout()
  }

  const truncateName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + "..."
  }

  const handleOrganizationClick = (identifier: string) => {
    setSelectedOrganizationIdentifier(identifier)
    setActiveSection("inbox")
    setSidebarOpen(false)
  }

  const sidebarItems = [
    { id: "send", label: "Odoslať", icon: Send, count: null },
    { id: "inbox", label: "Prijaté", icon: Inbox, count: null },
    { id: "sent", label: "Odoslané", icon: Archive, count: null },
    { id: "wallet", label: "Účet", icon: Wallet, count: null },
    { id: "profile", label: "Profil", icon: User, count: null },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case "inbox":
        return (
          <ReceivedDocumentsView
            organizationIdentifier={selectedOrganizationIdentifier}
            organizations={organizations}
          />
        )

      case "sent":
        return <SentDocumentsView organizations={organizations} />

      case "send":
        return <SendDocumentForm />

      case "wallet":
        return <WalletManagement onBalanceUpdate={refreshWalletBalance} />

      case "profile":
        return <UserProfileManagement />

      default:
        return null
    }
  }

  if (isLoading || !userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <div className="hidden lg:block fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">Demo poštár faktúr</span>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg bg-slate-800" />
            ))}
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24 bg-slate-700" />
                <Skeleton className="h-3 w-32 bg-slate-700" />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden w-full">
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>

          <main className="p-4">
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          </main>
        </div>

        <div className="hidden lg:block flex-1 ml-64">
          <main className="p-6">
            <div className="space-y-6">
              <Skeleton className="h-10 w-64" />
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-96 rounded-xl" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:relative lg:flex lg:flex-col
      `}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">Demo poštár faktúr</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-white hover:bg-slate-800"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {sidebarItems.map((item, index) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  setActiveSection(item.id)
                  if (item.id === "inbox") {
                    setSelectedOrganizationIdentifier(null)
                  }
                  setSidebarOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 ease-in-out
                  ${
                    activeSection === item.id && selectedOrganizationIdentifier === null
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-[1.02]"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white hover:scale-[1.01]"
                  }
                  ${
                    item.id === "wallet" && walletBalance && walletBalance.available < 0.04
                      ? "border-2 border-orange-400 bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
                      : ""
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`h-5 w-5 transition-transform duration-200 ${
                      activeSection === item.id ? "scale-110" : ""
                    } ${item.id === "wallet" && walletBalance && walletBalance.available < 0.04 ? "text-orange-400" : ""}`}
                  />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.id === "wallet" && (
                  <div
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      walletBalance && walletBalance.available < 0.04
                        ? "bg-orange-400/20 text-orange-300"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {walletLoading ? (
                      <div className="animate-pulse">Loading...</div>
                    ) : walletBalance?.available !== undefined ? (
                      <span>€{walletBalance.available.toFixed(2)}</span>
                    ) : (
                      <span>€0.00</span>
                    )}
                  </div>
                )}
              </button>

              {item.id === "inbox" && organizations.length > 0 && (
                <div className="mt-2 ml-4 space-y-1">
                  <button
                    onClick={() => setFoldersExpanded(!foldersExpanded)}
                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
                  >
                    {foldersExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Building2 className="h-3 w-3" />
                    <span className="font-medium">Firmy</span>
                  </button>

                  {foldersExpanded && (
                    <div className="space-y-1 pl-5">
                      {organizations.map((org) => {
                        const peppolIdentifier = org.identifiers?.find(
                          (id) => id.scheme === "iso6523-actorid-upis",
                        )?.identifier
                        if (!peppolIdentifier) return null

                        return (
                          <button
                            key={org.id}
                            onClick={() => handleOrganizationClick(peppolIdentifier)}
                            className={`
                            w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200
                            ${
                              selectedOrganizationIdentifier === peppolIdentifier
                                ? "bg-blue-600 text-white font-medium shadow-sm"
                                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            }
                          `}
                            title={org.name}
                          >
                            {truncateName(org.name)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {index === 0 && (
                <div className="my-3">
                  <div className="h-px bg-slate-800" />
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
            <Avatar className="h-8 w-8 ring-2 ring-blue-500">
              <AvatarFallback>
                <AvatarInitials name={`${userData.first_name} ${userData.last_name}`} />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userData.first_name} {userData.last_name}
              </p>
              <p className="text-xs text-slate-400 truncate">{userData.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-cyan-600 rounded flex items-center justify-center">
              <FileText className="h-3 w-3 text-white" />
            </div>
            <span className="font-bold text-slate-900">Demo poštár</span>
          </div>
          <div className="w-8" />
        </div>

        <main className="flex-1 p-6 overflow-auto">{renderContent()}</main>
      </div>
    </div>
  )
}
