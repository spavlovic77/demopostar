"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { AuthService, type UserData } from "@/lib/auth"

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

interface AppState {
  userData: UserData | null
  walletBalance: WalletBalance | null
  organizations: Organization[]
  isLoading: boolean
  walletLoading: boolean
}

interface AppContextType extends AppState {
  refreshUserData: () => Promise<void>
  refreshWalletBalance: () => Promise<void>
  refreshOrganizations: () => Promise<void>
  refreshAll: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    userData: null,
    walletBalance: null,
    organizations: [],
    isLoading: true,
    walletLoading: true,
  })

  const loadWalletBalance = async () => {
    try {
      setState((prev) => ({ ...prev, walletLoading: true }))
      const response = await fetch("/api/wallet/balance", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })

      if (response.ok) {
        const balance = await response.json()
        setState((prev) => ({
          ...prev,
          walletBalance: {
            available: balance.available_balance || 0,
            reserved: balance.reserved_balance || 0,
            total: balance.total_balance || 0,
          },
          walletLoading: false,
        }))
      } else {
        setState((prev) => ({ ...prev, walletLoading: false }))
      }
    } catch (error) {
      setState((prev) => ({ ...prev, walletLoading: false }))
    }
  }

  const loadOrganizations = async () => {
    try {
      const tokens = AuthService.getTokens()
      if (!tokens) return

      const user = await AuthService.getUserData()
      if (!user || !user.organizations || user.organizations.length === 0) return

      const orgPromises = user.organizations.map(async (orgName: string) => {
        try {
          const response = await fetch(`/api/organizations/search?name=${encodeURIComponent(orgName)}`, {
            headers: {
              Authorization: `Bearer ${tokens.access}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            return data
          }
        } catch (error) {
          return null
        }
        return null
      })

      const orgsData = await Promise.all(orgPromises)
      const validOrgs = orgsData.filter((org): org is Organization => org !== null)
      setState((prev) => ({ ...prev, organizations: validOrgs }))
    } catch (error) {
      // Silent error handling
    }
  }

  const loadUserData = async () => {
    try {
      if (!AuthService.isAuthenticated()) {
        AuthService.logout()
        return
      }

      const [user] = await Promise.all([AuthService.getUserData(), loadWalletBalance(), loadOrganizations()])

      if (user) {
        setState((prev) => ({ ...prev, userData: user, isLoading: false }))
      } else {
        AuthService.logout()
      }
    } catch (error) {
      AuthService.logout()
    }
  }

  useEffect(() => {
    loadUserData()
  }, [])

  const refreshUserData = async () => {
    const user = await AuthService.getUserData()
    if (user) {
      setState((prev) => ({ ...prev, userData: user }))
    }
  }

  const refreshWalletBalance = async () => {
    await loadWalletBalance()
  }

  const refreshOrganizations = async () => {
    await loadOrganizations()
  }

  const refreshAll = async () => {
    await loadUserData()
  }

  return (
    <AppContext.Provider
      value={{
        ...state,
        refreshUserData,
        refreshWalletBalance,
        refreshOrganizations,
        refreshAll,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}
