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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Používateľský profil</h1>
        <Button
          variant="outline"
          onClick={() => {
            refreshUserData()
            refreshOrganizations()
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Obnoviť
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="organizations">Organizácie</TabsTrigger>
          <TabsTrigger value="security">Zabezpečenie</TabsTrigger>
          <TabsTrigger value="tokens">API tokeny</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle className="h-6 w-6" />
                Organizácie, ku ktorým máte prístup
              </CardTitle>
              <CardDescription className="text-base">
                Zobrazenie detailov organizácií, ku ktorým patríte
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrganizations ? (
                <div className="space-y-6">
                  {[1, 2].map((i) => (
                    <Card key={i} className="border-2">
                      <CardContent className="p-8">
                        <div className="space-y-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-8 w-48" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-10 w-40" />
                          </div>

                          <div className="border-t pt-6 space-y-4">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-1 bg-primary rounded-full" />
                              <Skeleton className="h-6 w-24" />
                            </div>
                            <Skeleton className="h-16 w-full rounded-lg" />
                          </div>

                          <div className="border-t pt-6 space-y-4">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-1 bg-primary rounded-full" />
                              <Skeleton className="h-6 w-32" />
                            </div>
                            <div className="space-y-3">
                              {[1, 2].map((j) => (
                                <Skeleton key={j} className="h-16 w-full rounded-lg" />
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : detailedOrganizations.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenašli sa žiadne organizácie</h3>
                  <p className="text-muted-foreground">Zatiaľ nemáte prístup k žiadnym organizáciám</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {detailedOrganizations.map((org) => (
                    <Card key={org.id} className="border-2 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-8">
                        <div className="space-y-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-2xl font-bold text-foreground mb-1">{org.name}</h3>
                              <p className="text-base text-muted-foreground">ID: {org.id}</p>
                            </div>
                            <Dialog
                              open={addUserDialogOpen[org.id] || false}
                              onOpenChange={(open) => setAddUserDialogOpen({ ...addUserDialogOpen, [org.id]: open })}
                            >
                              <DialogTrigger asChild>
                                <Button size="lg" className="font-medium">
                                  <UserPlus className="h-5 w-5 mr-2" />
                                  Pridať používateľa
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Pridať nového používateľa</DialogTitle>
                                  <DialogDescription>
                                    Pridajte nového používateľa do organizácie <strong>{org.name}</strong>. Získa
                                    prístup k tejto organizácii.
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={(e) => handleAddUser(org.id, e)}>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor={`email-${org.id}`}>E-mail</Label>
                                      <Input
                                        id={`email-${org.id}`}
                                        type="email"
                                        placeholder="pouzivatel@priklad.sk"
                                        value={newUserEmail[org.id] || ""}
                                        onChange={(e) => setNewUserEmail({ ...newUserEmail, [org.id]: e.target.value })}
                                        required
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setAddUserDialogOpen({ ...addUserDialogOpen, [org.id]: false })}
                                    >
                                      Zrušiť
                                    </Button>
                                    <Button type="submit" disabled={isUpdating}>
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
                            <div className="border-t pt-6">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="h-8 w-1 bg-primary rounded-full" />
                                <h4 className="text-lg font-semibold text-foreground">Peppol ID</h4>
                              </div>
                              <div className="space-y-3">
                                {org.identifiers.map((identifier) => {
                                  const parseIdentifier = (fullIdentifier: string) => {
                                    const parts = fullIdentifier.split(":")
                                    return parts.length > 1 ? parts.slice(1).join(":") : fullIdentifier
                                  }

                                  const parsedIdentifier = parseIdentifier(identifier.identifier)

                                  return (
                                    <div
                                      key={identifier.id}
                                      className="p-4 bg-primary/5 border border-primary/20 rounded-lg"
                                    >
                                      <p className="font-mono text-lg font-medium text-foreground">
                                        {parsedIdentifier}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          <div className="border-t pt-6">
                            <button
                              onClick={() => toggleOrgExpansion(org.id)}
                              className="flex items-center gap-2 mb-4 w-full hover:opacity-80 transition-opacity"
                            >
                              <div className="h-8 w-1 bg-primary rounded-full" />
                              <h4 className="text-lg font-semibold text-foreground">Používatelia</h4>
                              {expandedOrgs[org.id] ? (
                                <ChevronDown className="h-5 w-5 ml-auto text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground" />
                              )}
                            </button>

                            {expandedOrgs[org.id] && (
                              <>
                                {loadingUsers[org.id] ? (
                                  <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-3 p-4 bg-muted/50 border border-muted rounded-lg"
                                      >
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                          <Skeleton className="h-4 w-48" />
                                          <Skeleton className="h-3 w-24" />
                                        </div>
                                        <Skeleton className="h-8 w-8 rounded" />
                                      </div>
                                    ))}
                                  </div>
                                ) : organizationUsers[org.id] && organizationUsers[org.id].length > 0 ? (
                                  <div className="space-y-3">
                                    {organizationUsers[org.id].map((user) => (
                                      <div
                                        key={user.id}
                                        className="flex items-center justify-between p-4 bg-muted/50 border border-muted rounded-lg hover:bg-muted/70 transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-primary font-semibold text-base">
                                              {user.email.charAt(0).toUpperCase()}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="text-base font-medium text-foreground">{user.email}</p>
                                            {user.email_verified && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                                <span className="text-xs text-green-600 font-medium">Overený</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveUser(org.id, user.id, user.email)}
                                          disabled={isUpdating}
                                          className="hover:bg-destructive/10"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-6 px-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                                    <p className="text-base text-muted-foreground">Žiadni používatelia</p>
                                  </div>
                                )}
                              </>
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
