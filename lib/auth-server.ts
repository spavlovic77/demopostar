// Server-side authentication utilities for API routes
export interface AuthTokens {
  access: string
  refresh: string
}

export interface UserData {
  email: string
  email_verified: boolean
  account: string | null
  account_roles: string[]
  account_type: string | null
  organizations: string[]
}

export class ServerAuthService {
  private static readonly ION_AP_BASE_URL = "https://test.ion-ap.net/api/v2"

  static async refreshToken(refreshToken: string): Promise<AuthTokens | null> {
    try {
      console.log("[v0] Refreshing ion-AP token...")

      const response = await fetch(`${this.ION_AP_BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      })

      console.log("[v0] Token refresh response status:", response.status)

      if (!response.ok) {
        console.log("[v0] Token refresh failed")
        return null
      }

      const tokens = await response.json()
      console.log("[v0] Token refresh successful")
      return {
        access: tokens.access,
        refresh: tokens.refresh || refreshToken, // Use new refresh token if provided, otherwise keep the old one
      }
    } catch (error) {
      console.error("[v0] Token refresh error:", error)
      return null
    }
  }

  static async makeAuthenticatedRequest(
    url: string,
    options: RequestInit,
    accessToken: string,
    refreshToken?: string,
  ): Promise<{ response: Response; newTokens?: AuthTokens }> {
    try {
      // First attempt with current token
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `JWT ${accessToken}`,
        },
      })

      // If successful, return the response
      if (response.ok) {
        return { response }
      }

      // If 401 and we have a refresh token, try to refresh
      if (response.status === 401 && refreshToken) {
        console.log("[v0] Access token expired, attempting refresh...")

        const newTokens = await this.refreshToken(refreshToken)
        if (newTokens) {
          console.log("[v0] Token refreshed successfully, retrying request...")

          // Retry the request with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `JWT ${newTokens.access}`,
            },
          })

          return { response: retryResponse, newTokens }
        }
      }

      // Return the original response if refresh failed or not attempted
      return { response }
    } catch (error) {
      console.error("[v0] Authenticated request error:", error)
      throw error
    }
  }

  static async validateToken(token: string): Promise<UserData | null> {
    try {
      console.log("[v0] Validating token:", token.substring(0, 20) + "...")

      const response = await fetch(`${this.ION_AP_BASE_URL}/auth/user_data`, {
        headers: {
          Authorization: `JWT ${token}`,
        },
      })

      console.log("[v0] Token validation response status:", response.status)

      if (!response.ok) {
        console.log("[v0] Token validation failed")
        return null
      }

      const userData = await response.json()
      console.log("[v0] Token validation successful for user:", userData.email)
      return userData
    } catch (error) {
      console.error("[v0] Token validation error:", error)
      return null
    }
  }

  static async getUserFromRequest(request: Request): Promise<UserData | null> {
    const authHeader = request.headers.get("Authorization")
    console.log("[v0] Getting user from request, auth header:", !!authHeader)

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[v0] No valid auth header found")
      return null
    }

    const token = authHeader.substring(7)
    return await this.validateToken(token)
  }
}

export { ServerAuthService as AuthServerService }

export const getUserFromRequest = ServerAuthService.getUserFromRequest
