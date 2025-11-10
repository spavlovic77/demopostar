"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Lock, CheckCircle, AlertCircle, Key, Shield, Loader2, Save, RefreshCw, UserPlus } from "lucide-react"
import { AuthService, type UserData } from "@/lib/auth"
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
  email_verified: string
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
  const [userData, setUserData] = useState<UserData | null>(null)
  const [organizationData, setOrganizationData] = useState<string[]>([])
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [peppolIdentifiers, setPeppolIdentifiers] = useState<PeppolIdentifier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [addUserDialogOpen, setAddUserDialogOpen] = useState<{ [key: number]: boolean }>({})
  const [newUserEmail, setNewUserEmail] = useState<{ [key: number]: string }>({})
  const [detailedOrganizations, setDetailedOrganizations] = useState<OrganizationDetails[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    console.log("[v0] Loading user profile...")
    setLoading(true)
    setError("")

    try {
      const tokens = AuthService.getTokens()
      if (!tokens) throw new Error("Authentication required")

      console.log("[v0] Tokens available, fetching user data...")

      const user = await AuthService.getUserData()
      if (!user) {
        throw new Error("Failed to load user data")
      }
      setUserData(user)
      console.log("[v0] User data loaded:", user)

      if (user.organizations && user.organizations.length > 0) {
        await loadDetailedOrganizations(user.organizations)
      }

      // First get organizations from ion-AP
      const organizationsResponse = await fetch("/api/ion-ap/organizations", {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (!organizationsResponse.ok) {
        console.log("[v0] Organizations response failed:", organizationsResponse.status)
        throw new Error("Failed to load organizations")
      }

      const organizationsData = await organizationsResponse.json()
      console.log("[v0] Organizations data:", organizationsData)

      const orgs = organizationsData.results || []
      setOrganizations(orgs)
      const orgNames = orgs.map((org: any) => org.name)
      const orgIds = orgs.map((org: any) => org.id)

      setOrganizationData(orgNames)

      // Fetch Peppol identifiers for the first organization
      if (orgIds.length > 0) {
        console.log("[v0] Fetching Peppol identifiers for organization:", orgIds[0])

        try {
          const identifiersResponse = await fetch(`/api/ion-ap/organizations/${orgIds[0]}/identifiers`, {
            headers: {
              Authorization: `Bearer ${tokens.access}`,
            },
          })

          if (identifiersResponse.ok) {
            const identifiersData = await identifiersResponse.json()
            console.log("[v0] Peppol identifiers:", identifiersData)
            setPeppolIdentifiers(identifiersData.results || [])
          } else {
            console.log("[v0] Identifiers response failed:", identifiersResponse.status)
            setPeppolIdentifiers([])
          }
        } catch (identifierError) {
          console.log("[v0] Error fetching identifiers:", identifierError)
          setPeppolIdentifiers([])
        }
      } else {
        console.log("[v0] No organizations found")
        setPeppolIdentifiers([])
      }

      // Load additional profile data
      await loadApiTokens()

      console.log("[v0] Profile loaded successfully")
    } catch (err) {
      console.log("[v0] Profile loading error:", err)
      setError(err instanceof Error ? err.message : "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const loadDetailedOrganizations = async (organizationNames: string[]) => {
    setLoadingOrganizations(true)
    console.log("[v0] Loading detailed organizations for:", organizationNames)

    try {
      const detailedOrgs: OrganizationDetails[] = []

      for (const orgName of organizationNames) {
        try {
          const response = await fetch(`/api/organizations/search?name=${encodeURIComponent(orgName)}`)

          if (response.ok) {
            const orgDetails = await response.json()
            detailedOrgs.push(orgDetails)
            console.log("[v0] Loaded details for:", orgName, orgDetails)
          } else {
            console.log("[v0] Failed to load details for:", orgName)
          }
        } catch (err) {
          console.log("[v0] Error loading organization:", orgName, err)
        }
      }

      setDetailedOrganizations(detailedOrgs)
      console.log("[v0] All detailed organizations loaded:", detailedOrgs)
    } catch (err) {
      console.log("[v0] Error loading detailed organizations:", err)
    } finally {
      setLoadingOrganizations(false)
    }
  }

  const loadApiTokens = async () => {
    // Note: This would require an endpoint to list user's API tokens
    // For now, we'll show a placeholder
    setApiTokens([])
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
          // Try to refresh token
          const newTokens = await AuthService.refreshToken()
          if (newTokens) {
            // Retry with new token
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
        await loadApiTokens()
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user")
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Načítavam profil...</p>
      </div>
    )
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
        <Button variant="outline" onClick={loadUserProfile} disabled={loading}>
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
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Organizácie, ku ktorým máte prístup
              </CardTitle>
              <CardDescription>Zobrazenie detailov organizácií, ku ktorým patríte</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrganizations ? (
                <div className="text-center py-8">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Načítavam organizácie...</p>
                </div>
              ) : detailedOrganizations.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenašli sa žiadne organizácie</h3>
                  <p className="text-muted-foreground">Zatiaľ nemáte prístup k žiadnym organizáciám</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detailedOrganizations.map((org) => (
                    <Card key={org.id} className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-foreground">{org.name}</h3>
                          <Dialog
                            open={addUserDialogOpen[org.id] || false}
                            onOpenChange={(open) => setAddUserDialogOpen({ ...addUserDialogOpen, [org.id]: open })}
                          >
                            <DialogTrigger asChild>
                              <Button size="sm">
                                <UserPlus className="h-4 w-4 mr-2" />
                                Pridať používateľa
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Pridať nového používateľa</DialogTitle>
                                <DialogDescription>
                                  Pridajte nového používateľa do organizácie <strong>{org.name}</strong>. Získa prístup
                                  k tejto organizácii.
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
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Identifikátory</p>
                            <div className="space-y-2">
                              {org.identifiers.map((identifier) => {
                                const parseIdentifier = (fullIdentifier: string) => {
                                  // Remove scheme prefix (e.g., "iso6523-actorid-upis:") and return only the value part
                                  const parts = fullIdentifier.split(":")
                                  // If format is "scheme:value1:value2", return "value1:value2"
                                  // If format is "scheme:value", return "value"
                                  return parts.length > 1 ? parts.slice(1).join(":") : fullIdentifier
                                }

                                const parsedIdentifier = parseIdentifier(identifier.identifier)

                                return (
                                  <div key={identifier.id} className="p-3 bg-muted/50 rounded-lg">
                                    <p className="font-mono text-sm text-foreground">{parsedIdentifier}</p>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
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
