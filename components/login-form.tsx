"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Building, Copy, Check } from "lucide-react"

interface LoginData {
  email: string
  password: string
}

interface RegistrationData {
  // Organization data
  organizationName: string
  publishInSmp: boolean
  // Identifier data
  identifier: string
  // User data
  email: string
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null)
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
  })
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    organizationName: "",
    publishInSmp: true,
    identifier: "",
    email: "",
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      console.log("[v0] Starting login process for:", loginData.email)

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password,
        }),
      })

      console.log("[v0] Login response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.log("[v0] Login failed with error:", errorData)
        throw new Error(errorData.error || "Invalid credentials")
      }

      const data = await response.json()
      console.log("[v0] Login successful, received data:", data)

      if (!data.access || !data.refresh) {
        console.error("[v0] Missing tokens in response:", data)
        throw new Error("Invalid response from server")
      }

      console.log("[v0] Storing tokens in localStorage")

      try {
        // Test localStorage availability with a more comprehensive check
        const testKey = "__localStorage_test__"
        const testValue = "test"

        try {
          localStorage.setItem(testKey, testValue)
          const retrieved = localStorage.getItem(testKey)
          localStorage.removeItem(testKey)

          if (retrieved !== testValue) {
            throw new Error("localStorage test failed - values don't match")
          }
        } catch (testError) {
          console.error("[v0] localStorage test failed:", testError)
          throw new Error("localStorage is not available or not working properly")
        }

        // Store tokens with error handling for each operation
        try {
          localStorage.setItem("access_token", data.access)
        } catch (accessError) {
          console.error("[v0] Failed to store access token:", accessError)
          throw new Error("Failed to store access token")
        }

        try {
          localStorage.setItem("refresh_token", data.refresh)
        } catch (refreshError) {
          console.error("[v0] Failed to store refresh token:", refreshError)
          // Try to clean up access token if refresh fails
          localStorage.removeItem("access_token")
          throw new Error("Failed to store refresh token")
        }

        // Verification with retry mechanism
        let verificationAttempts = 0
        const maxAttempts = 3
        let storedAccess = null
        let storedRefresh = null

        while (verificationAttempts < maxAttempts) {
          storedAccess = localStorage.getItem("access_token")
          storedRefresh = localStorage.getItem("refresh_token")

          if (storedAccess && storedRefresh) {
            break
          }

          verificationAttempts++
          console.log(`[v0] Token verification attempt ${verificationAttempts}/${maxAttempts}`)

          // Small delay before retry
          await new Promise((resolve) => setTimeout(resolve, 10))
        }

        console.log("[v0] Token storage verification:", {
          accessStored: storedAccess !== null,
          refreshStored: storedRefresh !== null,
          accessLength: storedAccess?.length || 0,
          refreshLength: storedRefresh?.length || 0,
          accessMatches: storedAccess === data.access,
          refreshMatches: storedRefresh === data.refresh,
          attempts: verificationAttempts,
        })

        if (!storedAccess || !storedRefresh) {
          console.error("[v0] Token storage failed after", verificationAttempts, "attempts")
          throw new Error("Failed to store authentication tokens - verification failed")
        }

        if (storedAccess !== data.access || storedRefresh !== data.refresh) {
          console.error("[v0] Token storage failed - stored tokens don't match received tokens")
          throw new Error("Token storage verification failed - data mismatch")
        }

        console.log("[v0] Tokens stored and verified successfully")
      } catch (storageError) {
        console.error("[v0] localStorage error:", storageError)

        if (storageError.message.includes("localStorage is not available")) {
          throw new Error(
            "Your browser doesn't support local storage or it's disabled. Please enable cookies and local storage, or try a different browser.",
          )
        } else if (storageError.message.includes("quota")) {
          throw new Error("Browser storage is full. Please clear your browser data and try again.")
        } else {
          throw new Error(
            `Authentication storage failed: ${storageError.message}. Please try refreshing the page or using a different browser.`,
          )
        }
      }

      console.log("[v0] Redirecting to dashboard")
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 100)
    } catch (err) {
      console.error("[v0] Login error:", err)
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      console.log("[v0] Starting registration process")

      if (!/^\d{10}$/.test(registrationData.identifier)) {
        throw new Error("Identifier must be exactly 10 digits")
      }

      // Step 1: Create organization
      console.log("[v0] Creating organization:", {
        name: registrationData.organizationName,
        country: "SK", // Default to SK
        publish_in_smp: registrationData.publishInSmp,
      })

      const orgResponse = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registrationData.organizationName,
          country: "SK", // Always use SK
          publish_in_smp: registrationData.publishInSmp,
        }),
      })

      console.log("[v0] Organization response status:", orgResponse.status)

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json()
        console.log("[v0] Organization creation failed:", errorData)
        throw new Error(`Failed to create organization: ${errorData.details || errorData.error}`)
      }

      const orgData = await orgResponse.json()
      console.log("[v0] Organization created:", orgData)
      const organizationId = orgData.id

      // Step 2: Add identifier to organization
      const identifierResponse = await fetch(`/api/organizations/${organizationId}/identifiers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheme: "9950", // Always use 9950
          identifier: registrationData.identifier,
          verified: true,
        }),
      })

      console.log("[v0] Identifier response status:", identifierResponse.status)

      if (!identifierResponse.ok) {
        const errorData = await identifierResponse.json()
        console.log("[v0] Identifier addition failed:", errorData)
        throw new Error(`Failed to add identifier: ${errorData.details || errorData.error}`)
      }

      const userResponse = await fetch(`/api/organizations/${organizationId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: registrationData.email,
          first_name: registrationData.organizationName, // Use organization name as first name
          last_name: "Admin", // Default last name
          password: `${registrationData.identifier}@${registrationData.organizationName.replace(/\s+/g, "")}`, // Generate password from identifier and org name
        }),
      })

      console.log("[v0] User response status:", userResponse.status)

      if (!userResponse.ok) {
        const errorData = await userResponse.json()
        console.log("[v0] User creation failed:", errorData)
        throw new Error(`Failed to create user: ${errorData.details || errorData.error}`)
      }

      setSuccess("Registration successful! You can now log in with your credentials.")

      // Reset form
      setRegistrationData({
        organizationName: "",
        publishInSmp: true,
        identifier: "",
        email: "",
      })
    } catch (err) {
      console.error("[v0] Registration error:", err)
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, field: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("[v0] Failed to copy:", err)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Demo digitálny poštár faktúr</CardTitle>
        <CardDescription className="text-center">Prihláste sa do svojho účtu alebo vytvorte nový</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Prihlásenie</TabsTrigger>
            <TabsTrigger value="register">Registrácia</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <AlertDescription className="text-sm">
                  <div className="font-semibold mb-2">Demo prihlasovacie údaje:</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">E-mail:</span> jankouctovnik@gmail.com
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                        onClick={() => handleCopy("jankouctovnik@gmail.com", "email")}
                      >
                        {copiedField === "email" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">Heslo:</span> .Nbu123?
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                        onClick={() => handleCopy(".Nbu123?", "password")}
                      >
                        {copiedField === "password" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Zadajte váš e-mail"
                    className="pl-10"
                    value={loginData.email}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Heslo</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Zadajte vaše heslo"
                    className="pl-10"
                    value={loginData.password}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Prihlásiť sa
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegistration} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Informácie o organizácii</Label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Názov organizácie *"
                        className="pl-10"
                        value={registrationData.organizationName}
                        onChange={(e) => setRegistrationData((prev) => ({ ...prev, organizationName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Peppol identifikátor (DIČO)</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Hodnota DIČO (presne 10 číslic) *"
                      value={registrationData.identifier}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setRegistrationData((prev) => ({ ...prev, identifier: value }))
                      }}
                      maxLength={10}
                      pattern="\d{10}"
                      required
                    />
                    {registrationData.identifier && registrationData.identifier.length !== 10 && (
                      <div className="text-sm text-destructive">
                        DIČO musí mať presne 10 číslic (aktuálne {registrationData.identifier.length})
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">E-mail</Label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="E-mailová adresa *"
                        className="pl-10"
                        value={registrationData.email}
                        onChange={(e) => setRegistrationData((prev) => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-accent text-accent-foreground bg-accent/10">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Vytvoriť účet
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
