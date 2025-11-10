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
      <div className="min-h-screen bg-background flex">
        <div className="hidden lg:block fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border">
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sidebar-foreground">Demo poštár faktúr</span>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-3 p-3 bg-sidebar-primary rounded-lg">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
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
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-96 rounded-lg" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:relative lg:flex lg:flex-col
      `}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sidebar-foreground">Demo poštár faktúr</span>
          </div>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
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
                  w-full flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200 ease-in-out
                  ${
                    activeSection === item.id && selectedOrganizationIdentifier === null
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm scale-[1.02]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:scale-[1.01] hover:shadow-sm"
                  }
                  ${
                    item.id === "wallet" && walletBalance && walletBalance.available < 5
                      ? "border-2 border-orange-400 bg-orange-50 text-orange-800 hover:bg-orange-100"
                      : ""
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`h-5 w-5 transition-transform duration-200 ${
                      activeSection === item.id ? "scale-110" : ""
                    } ${item.id === "wallet" && walletBalance && walletBalance.available < 5 ? "text-orange-600" : ""}`}
                  />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.id === "wallet" && (
                  <div
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      walletBalance && walletBalance.available < 5
                        ? "bg-orange-200 text-orange-800"
                        : "bg-sidebar-accent/20"
                    }`}
                  >
                    {walletLoading ? (
                      <div className="animate-pulse text-sidebar-foreground/50">Loading...</div>
                    ) : walletBalance?.available !== undefined ? (
                      <span
                        className={walletBalance.available < 5 ? "text-orange-800" : "text-sidebar-accent-foreground"}
                      >
                        €{walletBalance.available.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sidebar-foreground/50">€0.00</span>
                    )}
                  </div>
                )}
              </button>

              {item.id === "inbox" && organizations.length > 0 && (
                <div className="mt-2 ml-4 space-y-1">
                  <button
                    onClick={() => setFoldersExpanded(!foldersExpanded)}
                    className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors py-1"
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
                            w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200
                            ${
                              selectedOrganizationIdentifier === peppolIdentifier
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
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
                  <div className="h-px bg-sidebar-border" />
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3 p-3 bg-sidebar-primary rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                <AvatarInitials name={`${userData.first_name} ${userData.last_name}`} />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-primary-foreground truncate">
                {userData.first_name} {userData.last_name}
              </p>
              <p className="text-xs text-sidebar-primary-foreground/70 truncate">{userData.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <FileText className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Demo poštár</span>
          </div>
          <div className="w-8" />
        </div>

        <main className="flex-1 p-6 overflow-auto">{renderContent()}</main>
      </div>
    </div>
  )
}
