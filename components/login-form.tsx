"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Building, Copy, Check, Github } from "lucide-react"

interface LoginData {
  email: string
  password: string
}

interface RegistrationData {
  organizationName: string
  publishInSmp: boolean
  identifier: string
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
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
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

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Invalid credentials")
      }

      const data = await response.json()

      if (!data.access || !data.refresh) {
        throw new Error("Invalid response from server")
      }

      try {
        localStorage.setItem("access_token", data.access)
        localStorage.setItem("refresh_token", data.refresh)

        const storedAccess = localStorage.getItem("access_token")
        const storedRefresh = localStorage.getItem("refresh_token")

        if (!storedAccess || !storedRefresh) {
          throw new Error("Failed to store authentication tokens")
        }
      } catch (storageError) {
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

      router.push("/dashboard") // Redirect to dashboard, the dashboard-layout will handle setting activeSection to "send" by default
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
      setIsLoading(false) // Reset loading state on error
    }
  }

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      if (!/^\d{10}$/.test(registrationData.identifier)) {
        throw new Error("Identifier must be exactly 10 digits")
      }

      const orgResponse = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registrationData.organizationName,
          country: "SK",
          publish_in_smp: registrationData.publishInSmp,
        }),
      })

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json()
        throw new Error(`Failed to create organization: ${errorData.details || errorData.error}`)
      }

      const orgData = await orgResponse.json()
      const organizationId = orgData.id

      const identifierResponse = await fetch(`/api/organizations/${organizationId}/identifiers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheme: "9950",
          identifier: registrationData.identifier,
          verified: true,
        }),
      })

      if (!identifierResponse.ok) {
        const errorData = await identifierResponse.json()
        throw new Error(`Failed to add identifier: ${errorData.details || errorData.error}`)
      }

      const userResponse = await fetch(`/api/organizations/${organizationId}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: registrationData.email,
          first_name: registrationData.organizationName,
          last_name: "Admin",
          password: `${registrationData.identifier}@${registrationData.organizationName.replace(/\s+/g, "")}`,
        }),
      })

      if (!userResponse.ok) {
        const errorData = await userResponse.json()
        throw new Error(`Failed to create user: ${errorData.details || errorData.error}`)
      }

      setSuccess("Registration successful! You can now log in with your credentials.")

      setRegistrationData({
        organizationName: "",
        publishInSmp: true,
        identifier: "",
        email: "",
      })
    } catch (err) {
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
      // Silent failure for copy operation
    }
  }

  return (
    <Card className="w-full border-2 shadow-xl">
      <CardHeader className="space-y-3 pb-8 pt-8">
        <CardTitle className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Demo digitálny poštár
        </CardTitle>
        <CardDescription className="text-center text-base md:text-lg">Demo digitálny poštár faktúr</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-8 md:px-8">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 mb-6">
            <TabsTrigger value="login" className="text-base md:text-lg">
              Prihlásenie
            </TabsTrigger>
            <TabsTrigger value="register" className="text-base md:text-lg">
              Registrácia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-6 mt-6">
            <Alert className="border-2 border-primary/30 bg-primary/5 shadow-sm">
              <AlertDescription>
                <div className="font-semibold text-base mb-3">Demo prihlasovacie údaje:</div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">E-mail</div>
                      <div className="font-mono text-sm md:text-base break-all">jankouctovnik@gmail.com</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 shrink-0 hover:bg-primary/10"
                      onClick={() => handleCopy("jankouctovnik@gmail.com", "email")}
                    >
                      {copiedField === "email" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Heslo</div>
                      <div className="font-mono text-sm md:text-base">.Nbu123?</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 shrink-0 hover:bg-primary/10"
                      onClick={() => handleCopy(".Nbu123?", "password")}
                    >
                      {copiedField === "password" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Zadajte váš e-mail"
                    className="pl-12 h-14 text-base"
                    value={loginData.email}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium">
                  Heslo
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Zadajte vaše heslo"
                    className="pl-12 h-14 text-base"
                    value={loginData.password}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="border-2">
                  <AlertDescription className="text-sm md:text-base">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-14 text-base md:text-lg font-semibold" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Prihlasujem...
                  </>
                ) : (
                  "Prihlásiť sa"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <a
                href="https://github.com/spavlovic77/demopostar"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
              >
                <Github className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Zobraziť na GitHub</span>
              </a>
            </div>
          </TabsContent>

          <TabsContent value="register" className="space-y-6 mt-6">
            <form onSubmit={handleRegistration} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-base font-medium">Názov organizácie</Label>
                <div className="relative">
                  <Building className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Zadajte názov organizácie *"
                    className="pl-12 h-14 text-base"
                    value={registrationData.organizationName}
                    onChange={(e) => setRegistrationData((prev) => ({ ...prev, organizationName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Peppol identifikátor (DIČO)</Label>
                <Input
                  placeholder="Presne 10 číslic *"
                  className="h-14 text-base font-mono"
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
                  <div className="text-sm text-destructive font-medium">
                    DIČO musí mať presne 10 číslic (aktuálne {registrationData.identifier.length})
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Zadajte e-mailovú adresu *"
                    className="pl-12 h-14 text-base"
                    value={registrationData.email}
                    onChange={(e) => setRegistrationData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="border-2">
                  <AlertDescription className="text-sm md:text-base">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-2 border-accent bg-accent/10">
                  <AlertDescription className="text-sm md:text-base">{success}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-14 text-base md:text-lg font-semibold" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Vytváram účet...
                  </>
                ) : (
                  "Vytvoriť účet"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
