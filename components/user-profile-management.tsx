"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Lock,
  CheckCircle,
  AlertCircle,
  Key,
  Shield,
  Loader2,
  Save,
  RefreshCw,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
} from "lucide-react"
import { AuthService } from "@/lib/auth"
import { useAppContext } from "@/lib/app-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ApiToken {
  key: string
  created: string
  name?: string
}

interface PeppolIdentifier {
  id: number
  scheme: string
  identifier: string
  verified: boolean
}

interface OrganizationUser {
  id: number
  email: string
  email_verified: boolean
}

interface OrganizationDetails {
  id: number
  name: string
  country: string
  publish_in_smp: boolean
  reference: string
  identifiers: {
    id: number
    scheme: string
    identifier: string
    verified: boolean
    publish_receive_peppolbis: boolean
    publish_receive_nlcius: boolean
    publish_receive_invoice_response: boolean
    links: {
      self: string
    }
  }[]
  links: {
    self: string
    identifiers: string
    receive_triggers: string
    receive_trigger_options: string
    users: string
    logs: string
  }
}

interface Organization {
  id: number
  name: string
}

export function UserProfileManagement() {
  const { userData, organizations, refreshUserData, refreshOrganizations } = useAppContext()

  const [organizationData, setOrganizationData] = useState<string[]>([])
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [peppolIdentifiers, setPeppolIdentifiers] = useState<PeppolIdentifier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [addUserDialogOpen, setAddUserDialogOpen] = useState<{ [key: number]: boolean }>({})
  const [newUserEmail, setNewUserEmail] = useState<{ [key: number]: string }>({})
  const [detailedOrganizations, setDetailedOrganizations] = useState<OrganizationDetails[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [organizationUsers, setOrganizationUsers] = useState<{ [key: number]: OrganizationUser[] }>({})
  const [loadingUsers, setLoadingUsers] = useState<{ [key: number]: boolean }>({})
  const [expandedOrgs, setExpandedOrgs] = useState<{ [key: number]: boolean }>({})

  useEffect(() => {
    if (organizations.length > 0) {
      loadDetailedOrganizations()
    }
  }, [organizations])

  const loadDetailedOrganizations = async () => {
    setLoadingOrganizations(true)

    try {
      const detailedOrgs: OrganizationDetails[] = []

      const detailPromises = organizations.map(async (org) => {
        try {
          const response = await fetch(`/api/organizations/search?name=${encodeURIComponent(org.name)}`)

          if (response.ok) {
            const orgDetails = await response.json()
            return orgDetails
          }
        } catch (err) {
          return null
        }
        return null
      })

      const results = await Promise.all(detailPromises)
      const validOrgs = results.filter((org): org is OrganizationDetails => org !== null)

      setDetailedOrganizations(validOrgs)

      await Promise.all(validOrgs.map((org) => loadOrganizationUsers(org.id)))
    } catch (err) {
      // Silent error handling
    } finally {
      setLoadingOrganizations(false)
    }
  }

  const loadOrganizationUsers = async (orgId: number) => {
    if (organizationUsers[orgId]) {
      return
    }

    setLoadingUsers((prev) => ({ ...prev, [orgId]: true }))

    try {
      const response = await fetch(`/api/organizations/${orgId}/users`)

      if (response.ok) {
        const data = await response.json()
        const users = data.results || []
        setOrganizationUsers((prev) => ({ ...prev, [orgId]: users }))
      } else {
        setOrganizationUsers((prev) => ({ ...prev, [orgId]: [] }))
      }
    } catch (err) {
      setOrganizationUsers((prev) => ({ ...prev, [orgId]: [] }))
    } finally {
      setLoadingUsers((prev) => ({ ...prev, [orgId]: false }))
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    setError("")
    setSuccess("")

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match")
      setIsUpdating(false)
      return
    }

    if (passwordData.newPassword.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsUpdating(false)
      return
    }

    const tokens = AuthService.getTokens()
    if (!tokens) {
      setError("Authentication required")
      setIsUpdating(false)
      return
    }

    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({
          old_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          const newTokens = await AuthService.refreshToken()
          if (newTokens) {
            const retryResponse = await fetch("/api/auth/update-password", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newTokens.access}`,
              },
              body: JSON.stringify({
                old_password: passwordData.currentPassword,
                new_password: passwordData.newPassword,
              }),
            })

            if (!retryResponse.ok) {
              throw new Error("Failed to update password")
            }
          } else {
            throw new Error("Authentication failed")
          }
        } else {
          throw new Error("Failed to update password")
        }
      }

      setSuccess("Password updated successfully")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password")
    } finally {
      setIsUpdating(false)
    }
  }

  const createApiToken = async () => {
    const tokens = AuthService.getTokens()
    if (!tokens) return

    try {
      const response = await fetch("/api/auth/create-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (response.ok) {
        setSuccess("API token created successfully")
      } else {
        throw new Error("Failed to create API token")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API token")
    }
  }

  const handleAddUser = async (orgId: number, e: React.FormEvent) => {
    e.preventDefault()

    setIsUpdating(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`/api/organizations/${orgId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail[orgId] || "",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add user")
      }

      setSuccess("User added successfully")
      setAddUserDialogOpen({ ...addUserDialogOpen, [orgId]: false })
      setNewUserEmail({ ...newUserEmail, [orgId]: "" })

      await loadOrganizationUsers(orgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveUser = async (orgId: number, userId: number, userEmail: string) => {
    if (!confirm(`Naozaj chcete odstrániť používateľa ${userEmail} z organizácie?`)) {
      return
    }

    setIsUpdating(true)
    setError("")
    setSuccess("")

    try {
      const tokens = AuthService.getTokens()
      if (!tokens) throw new Error("Authentication required")

      const response = await fetch(`/api/organizations/${orgId}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to remove user")
      }

      setSuccess("User removed successfully")

      await loadOrganizationUsers(orgId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove user")
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleOrgExpansion = (orgId: number) => {
    const isExpanding = !expandedOrgs[orgId]
    setExpandedOrgs((prev) => ({ ...prev, [orgId]: isExpanding }))

    if (isExpanding && !organizationUsers[orgId]) {
      loadOrganizationUsers(orgId)
    }
  }

  if (!userData) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Nepodarilo sa načítať používateľský profil</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-3xl font-bold text-foreground">Profil</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refreshUserData()
            refreshOrganizations()
          }}
          disabled={loading}
          className="lg:h-10"
        >
          <RefreshCw className={`h-4 w-4 lg:mr-2 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden lg:inline">Obnoviť</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-accent bg-accent/10">
          <CheckCircle className="h-4 w-4 text-accent" />
          <AlertDescription className="text-accent-foreground">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9 lg:h-10">
          <TabsTrigger value="organizations" className="text-xs lg:text-sm">
            <Building2 className="h-3 w-3 lg:h-4 lg:w-4 lg:mr-1" />
            <span className="hidden sm:inline">Organizácie</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs lg:text-sm">
            <Shield className="h-3 w-3 lg:h-4 lg:w-4 lg:mr-1" />
            <span className="hidden sm:inline">Zabezpečenie</span>
          </TabsTrigger>
          <TabsTrigger value="tokens" className="text-xs lg:text-sm">
            <Key className="h-3 w-3 lg:h-4 lg:w-4 lg:mr-1" />
            <span className="hidden sm:inline">API tokeny</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-3 lg:space-y-6">
          <Card>
            <CardHeader className="p-4 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-base lg:text-2xl">
                <Building2 className="h-4 w-4 lg:h-6 lg:w-6" />
                <span className="hidden lg:inline">Organizácie, ku ktorým máte prístup</span>
                <span className="lg:hidden">Moje organizácie</span>
              </CardTitle>
              <CardDescription className="text-xs lg:text-base hidden lg:block">
                Zobrazenie detailov organizácií, ku ktorým patríte
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              {loadingOrganizations ? (
                <div className="space-y-3 lg:space-y-6">
                  {[1, 2].map((i) => (
                    <Card key={i} className="border">
                      <CardContent className="p-4 lg:p-8">
                        <div className="space-y-3 lg:space-y-6">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-5 lg:h-8 w-32 lg:w-48" />
                              <Skeleton className="h-3 lg:h-4 w-20 lg:w-32" />
                            </div>
                            <Skeleton className="h-8 lg:h-10 w-8 lg:w-40" />
                          </div>
                          <div className="border-t pt-3 lg:pt-6 space-y-2 lg:space-y-4">
                            <Skeleton className="h-4 lg:h-6 w-20 lg:w-24" />
                            <Skeleton className="h-12 lg:h-16 w-full rounded-lg" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : detailedOrganizations.length === 0 ? (
                <div className="text-center py-6 lg:py-8">
                  <AlertCircle className="mx-auto h-8 w-8 lg:h-12 lg:w-12 text-muted-foreground mb-3 lg:mb-4" />
                  <h3 className="text-sm lg:text-lg font-medium text-foreground mb-1 lg:mb-2">
                    Nenašli sa žiadne organizácie
                  </h3>
                  <p className="text-xs lg:text-base text-muted-foreground">
                    Zatiaľ nemáte prístup k žiadnym organizáciám
                  </p>
                </div>
              ) : (
                <div className="space-y-3 lg:space-y-6">
                  {detailedOrganizations.map((org) => (
                    <Card
                      key={org.id}
                      className="border hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
                    >
                      <CardContent className="p-4 lg:p-6">
                        <div className="space-y-3 lg:space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base lg:text-xl font-bold text-foreground mb-0.5 lg:mb-1 truncate">
                                {org.name}
                              </h3>
                              <p className="text-xs lg:text-sm text-muted-foreground">ID: {org.id}</p>
                            </div>
                            <Dialog
                              open={addUserDialogOpen[org.id] || false}
                              onOpenChange={(open) => setAddUserDialogOpen({ ...addUserDialogOpen, [org.id]: open })}
                            >
                              <DialogTrigger asChild>
                                <Button size="sm" className="shrink-0 lg:size-default">
                                  <UserPlus className="h-4 w-4 lg:mr-2" />
                                  <span className="hidden lg:inline">Pridať používateľa</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-[calc(100vw-2rem)] lg:max-w-lg">
                                <DialogHeader>
                                  <DialogTitle className="text-base lg:text-lg">Pridať nového používateľa</DialogTitle>
                                  <DialogDescription className="text-xs lg:text-sm">
                                    Pridajte nového používateľa do organizácie <strong>{org.name}</strong>. Získa
                                    prístup k tejto organizácii.
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={(e) => handleAddUser(org.id, e)}>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor={`email-${org.id}`} className="text-sm">
                                        E-mail
                                      </Label>
                                      <Input
                                        id={`email-${org.id}`}
                                        type="email"
                                        placeholder="pouzivatel@priklad.sk"
                                        value={newUserEmail[org.id] || ""}
                                        onChange={(e) => setNewUserEmail({ ...newUserEmail, [org.id]: e.target.value })}
                                        required
                                        className="text-sm"
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter className="flex-col sm:flex-row gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setAddUserDialogOpen({ ...addUserDialogOpen, [org.id]: false })}
                                      className="w-full sm:w-auto text-sm"
                                    >
                                      Zrušiť
                                    </Button>
                                    <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto text-sm">
                                      {isUpdating ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Pridávam...
                                        </>
                                      ) : (
                                        "Pridať používateľa"
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </div>

                          {org.identifiers && org.identifiers.length > 0 && (
                            <div className="border-t pt-3 lg:pt-4">
                              <div className="flex items-center gap-1.5 lg:gap-2 mb-2 lg:mb-3">
                                <div className="h-6 lg:h-8 w-0.5 lg:w-1 bg-primary rounded-full" />
                                <h4 className="text-sm lg:text-base font-semibold text-foreground">Peppol ID</h4>
                              </div>
                              <div className="space-y-2">
                                {org.identifiers.map((identifier) => {
                                  const parseIdentifier = (fullIdentifier: string) => {
                                    const parts = fullIdentifier.split(":")
                                    return parts.length > 1 ? parts.slice(1).join(":") : fullIdentifier
                                  }

                                  const parsedIdentifier = parseIdentifier(identifier.identifier)

                                  return (
                                    <div
                                      key={identifier.id}
                                      className="p-2 lg:p-3 bg-primary/5 border border-primary/20 rounded-lg"
                                    >
                                      <p className="font-mono text-sm lg:text-base font-medium text-foreground break-all">
                                        {parsedIdentifier}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          <div className="border-t pt-3 lg:pt-4">
                            <button
                              onClick={() => toggleOrgExpansion(org.id)}
                              className="flex items-center gap-1.5 lg:gap-2 w-full hover:opacity-70 transition-opacity"
                            >
                              <div className="h-6 lg:h-8 w-0.5 lg:w-1 bg-primary rounded-full" />
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <h4 className="text-sm lg:text-base font-semibold text-foreground">Používatelia</h4>
                              <span className="text-xs lg:text-sm text-muted-foreground ml-1">
                                ({organizationUsers[org.id]?.length || 0})
                              </span>
                              {expandedOrgs[org.id] ? (
                                <ChevronDown className="h-4 w-4 lg:h-5 lg:w-5 ml-auto text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5 ml-auto text-muted-foreground" />
                              )}
                            </button>

                            {expandedOrgs[org.id] && (
                              <div className="mt-2 lg:mt-3">
                                {loadingUsers[org.id] ? (
                                  <div className="space-y-2">
                                    {[1, 2].map((i) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-2 lg:gap-3 p-2 lg:p-3 bg-muted/50 border border-muted rounded-lg"
                                      >
                                        <Skeleton className="h-8 w-8 lg:h-10 lg:w-10 rounded-full shrink-0" />
                                        <div className="flex-1 space-y-1 lg:space-y-2">
                                          <Skeleton className="h-3 lg:h-4 w-32 lg:w-48" />
                                          <Skeleton className="h-2 lg:h-3 w-16 lg:w-24" />
                                        </div>
                                        <Skeleton className="h-6 w-6 lg:h-8 lg:w-8 rounded shrink-0" />
                                      </div>
                                    ))}
                                  </div>
                                ) : organizationUsers[org.id] && organizationUsers[org.id].length > 0 ? (
                                  <div className="space-y-2">
                                    {organizationUsers[org.id].map((user) => (
                                      <div
                                        key={user.id}
                                        className="flex items-center justify-between gap-2 p-2 lg:p-3 bg-muted/50 border border-muted rounded-lg hover:bg-muted/70 transition-colors"
                                      >
                                        <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
                                          <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="text-primary font-semibold text-xs lg:text-base">
                                              {user.email.charAt(0).toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs lg:text-sm font-medium text-foreground truncate">
                                              {user.email}
                                            </p>
                                            {user.email_verified && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                                                <span className="text-[10px] lg:text-xs text-green-600 font-medium">
                                                  Overený
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveUser(org.id, user.id, user.email)}
                                          disabled={isUpdating}
                                          className="hover:bg-destructive/10 h-8 w-8 lg:h-9 lg:w-9 p-0 shrink-0"
                                        >
                                          <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 lg:py-6 px-3 lg:px-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                                    <p className="text-xs lg:text-sm text-muted-foreground">Žiadni používatelia</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Zmeniť heslo
              </CardTitle>
              <CardDescription>Aktualizujte heslo k vášmu účtu</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Aktuálne heslo</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="Zadajte aktuálne heslo"
                      className="pl-10"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nové heslo</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Zadajte nové heslo"
                      className="pl-10"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Potvrďte nové heslo</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Potvrďte nové heslo"
                      className="pl-10"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aktualizujem...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Aktualizovať heslo
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API tokeny
              </CardTitle>
              <CardDescription>Správa vašich API tokenov pre programový prístup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    API tokeny umožňujú autentifikáciu s ion-AP API programovo
                  </p>
                  <Button onClick={createApiToken}>
                    <Key className="mr-2 h-4 w-4" />
                    Vytvoriť token
                  </Button>
                </div>

                {apiTokens.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Žiadne API tokeny</h3>
                    <p className="text-muted-foreground">Vytvorte API token pre prístup k ion-AP API</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiTokens.map((token, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">API Token</p>
                            <p className="text-sm text-muted-foreground">Created: {token.created}</p>
                          </div>
                          <Button variant="destructive" size="sm">
                            Revoke
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
