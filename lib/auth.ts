// Authentication utilities
export interface AuthTokens {
  access: string
  refresh: string
}

export interface UserData {
  id: number
  email: string
  first_name: string
  last_name: string
  is_active: boolean
}

export class AuthService {
  private static readonly BASE_URL = "/api"

  static getTokens(): AuthTokens | null {
    if (typeof window === "undefined") return null

    const access = localStorage.getItem("access_token")
    const refresh = localStorage.getItem("refresh_token")

    if (!access || !refresh) return null

    return { access, refresh }
  }

  static setTokens(tokens: AuthTokens): void {
    if (typeof window === "undefined") return

    localStorage.setItem("access_token", tokens.access)
    localStorage.setItem("refresh_token", tokens.refresh)
  }

  static clearTokens(): void {
    if (typeof window === "undefined") return

    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  }

  static async refreshToken(): Promise<AuthTokens | null> {
    const tokens = this.getTokens()
    if (!tokens) return null

    try {
      const response = await fetch(`${this.BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: tokens.refresh,
        }),
      })

      if (!response.ok) {
        this.clearTokens()
        return null
      }

      const data = await response.json()
      const newTokens = { access: data.access, refresh: tokens.refresh }
      this.setTokens(newTokens)

      return newTokens
    } catch (error) {
      this.clearTokens()
      return null
    }
  }

  static async getUserData(): Promise<UserData | null> {
    const tokens = this.getTokens()
    if (!tokens) return null

    try {
      const response = await fetch(`${this.BASE_URL}/auth/user-data`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Try to refresh token
          const newTokens = await this.refreshToken()
          if (newTokens) {
            // Retry with new token
            const retryResponse = await fetch(`${this.BASE_URL}/auth/user-data`, {
              headers: {
                Authorization: `Bearer ${newTokens.access}`,
              },
            })

            if (retryResponse.ok) {
              return await retryResponse.json()
            }
          }
        }
        return null
      }

      return await response.json()
    } catch (error) {
      return null
    }
  }

  static isAuthenticated(): boolean {
    const tokens = this.getTokens()
    const isAuth = tokens !== null
    console.log("[v0] Authentication check - tokens exist:", isAuth)
    if (tokens) {
      console.log("[v0] Access token exists:", !!tokens.access)
      console.log("[v0] Refresh token exists:", !!tokens.refresh)
    }
    return isAuth
  }

  static logout(): void {
    this.clearTokens()
    window.location.href = "/"
  }
}
