import { createAdminClient } from "@/lib/supabase/server"

export interface WalletBalance {
  available_balance: number
  reserved_balance: number
  total_balance: number
}

export interface PendingTransaction {
  id: string
  user_email: string
  amount: number
  status: "pending" | "completed" | "failed"
  transaction_type: "send_document" | "top_up"
  ion_ap_transaction_id?: string
  metadata?: any
  created_at: string
}

export class WalletService {
  private adminSupabase: any = null

  private async getAdminSupabase() {
    if (!this.adminSupabase) {
      this.adminSupabase = await createAdminClient()
    }
    return this.adminSupabase
  }

  async getBalance(userEmail: string): Promise<WalletBalance | null> {
    const supabase = await this.getAdminSupabase()

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("available_balance, reserved_balance")
        .eq("email", userEmail)
        .maybeSingle()

      if (error) {
        console.error("[v0] Error fetching balance:", error)
        console.log("[v0] Attempting to create user profile after fetch error")
        await this.createUserProfile(userEmail)
        return {
          available_balance: 0,
          reserved_balance: 0,
          total_balance: 0,
        }
      }

      if (!data) {
        console.log("[v0] No user profile found, creating default profile for:", userEmail)
        const createResult = await this.createUserProfile(userEmail)

        if (!createResult.success) {
          console.error("[v0] Failed to create user profile:", createResult.error)
          return {
            available_balance: 0,
            reserved_balance: 0,
            total_balance: 0,
          }
        }

        return {
          available_balance: 0,
          reserved_balance: 0,
          total_balance: 0,
        }
      }

      return {
        available_balance: Number(data.available_balance) || 0,
        reserved_balance: Number(data.reserved_balance) || 0,
        total_balance: (Number(data.available_balance) || 0) + (Number(data.reserved_balance) || 0),
      }
    } catch (error) {
      console.error("[v0] Exception in getBalance:", error)
      return {
        available_balance: 0,
        reserved_balance: 0,
        total_balance: 0,
      }
    }
  }

  async reserveFunds(
    userEmail: string,
    amount: number,
    transactionType: string,
    metadata?: any,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const supabase = await this.getAdminSupabase()

    try {
      console.log("[v0] Starting reserveFunds for user:", userEmail, "amount:", amount, "type:", transactionType)

      const { data: currentBalance, error: balanceError } = await supabase
        .from("user_profiles")
        .select("id, email, available_balance, reserved_balance")
        .eq("email", userEmail)
        .maybeSingle()

      if (balanceError) {
        console.error("[v0] Error fetching balance for reservation:", balanceError)
        return { success: false, error: "Failed to fetch current balance" }
      }

      if (!currentBalance) {
        console.log("[v0] No profile found for reservation, creating one...")
        await this.createUserProfile(userEmail)
        return { success: false, error: "Insufficient funds" }
      }

      const availableBalance = Number(currentBalance.available_balance) || 0
      console.log("[v0] Current available balance:", availableBalance, "requested amount:", amount)

      if (availableBalance < amount) {
        console.log("[v0] Insufficient funds - available:", availableBalance, "required:", amount)
        return { success: false, error: "Insufficient funds" }
      }

      console.log("[v0] Updating balance - reducing available by:", amount)
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          available_balance: availableBalance - amount,
          reserved_balance: (Number(currentBalance.reserved_balance) || 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("email", userEmail)

      if (updateError) {
        console.error("[v0] Error updating balance for reservation:", updateError)
        return { success: false, error: "Failed to reserve funds" }
      }

      console.log("[v0] Creating pending transaction record...")
      const { data: transaction, error: transactionError } = await supabase
        .from("pending_transactions")
        .insert({
          user_id: currentBalance.id,
          amount: amount,
          status: "pending",
          transaction_type: transactionType.toLowerCase(), // Changed transaction types to lowercase
          metadata: { ...metadata, user_email: userEmail },
          reserved_at: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (transactionError || !transaction) {
        console.error("[v0] Error creating pending transaction:", transactionError)
        // Rollback balance changes
        await supabase
          .from("user_profiles")
          .update({
            available_balance: availableBalance,
            reserved_balance: Number(currentBalance.reserved_balance) || 0,
          })
          .eq("email", userEmail)

        return { success: false, error: "Failed to create transaction record" }
      }

      console.log("[v0] Successfully reserved funds, transaction ID:", transaction.id)
      return { success: true, transactionId: transaction.id }
    } catch (error) {
      console.error("[v0] Exception in reserveFunds:", error)
      return { success: false, error: "Internal error during fund reservation" }
    }
  }

  async completePendingTransaction(
    transactionId: string,
    ionApTransactionId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await this.getAdminSupabase()

    try {
      console.log("[v0] Starting completePendingTransaction for ID:", transactionId)

      const { data: transaction, error: fetchError } = await supabase
        .from("pending_transactions")
        .select("*")
        .eq("id", transactionId)
        .eq("status", "pending")
        .single()

      if (fetchError || !transaction) {
        console.error("[v0] Error fetching pending transaction:", fetchError)
        return { success: false, error: "Transaction not found or already processed" }
      }

      const { data: userProfile, error: profileFetchError } = await supabase
        .from("user_profiles")
        .select("id, email, available_balance, reserved_balance")
        .eq("id", transaction.user_id)
        .single()

      if (profileFetchError || !userProfile) {
        console.error("[v0] Error fetching user profile:", profileFetchError)
        return { success: false, error: "Failed to fetch user profile" }
      }

      const userEmail = userProfile.email
      console.log("[v0] Found pending transaction for user:", userEmail, "amount:", transaction.amount)

      const currentAvailableBalance = Number(userProfile.available_balance) || 0
      const currentReservedBalance = Number(userProfile.reserved_balance) || 0
      const totalBalanceBefore = currentAvailableBalance + currentReservedBalance
      const totalBalanceAfter = totalBalanceBefore - transaction.amount

      const newReservedBalance = currentReservedBalance - transaction.amount
      console.log(
        "[v0] Updating reserved balance from",
        userProfile.reserved_balance,
        "to",
        Math.max(0, newReservedBalance),
      )

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          reserved_balance: Math.max(0, newReservedBalance),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userProfile.id)

      if (updateError) {
        console.error("[v0] Error updating profile for completion:", updateError)
        return { success: false, error: "Failed to complete transaction" }
      }

      console.log("[v0] Updating pending transaction status to completed...")
      const { error: transactionUpdateError } = await supabase
        .from("pending_transactions")
        .update({
          status: "completed",
          ion_ap_transaction_id: ionApTransactionId,
          completed_at: new Date().toISOString(),
        })
        .eq("id", transactionId)

      if (transactionUpdateError) {
        console.error("[v0] Error updating transaction status:", transactionUpdateError)
      }

      console.log("[v0] Creating wallet transaction record with type: top_up")
      const { error: walletTransactionError } = await supabase.from("wallet_transactions").insert({
        user_id: userProfile.id,
        transaction_type: "top_up",
        amount: -transaction.amount,
        balance_before: totalBalanceBefore,
        balance_after: totalBalanceAfter,
        description: `Document sending fee - ${ionApTransactionId || transactionId}`,
        reference_id: transactionId,
        metadata: { ion_ap_transaction_id: ionApTransactionId, user_email: userEmail },
      })

      if (walletTransactionError) {
        console.error("[v0] Error creating wallet transaction record:", walletTransactionError)
        return { success: false, error: "Failed to create transaction record" }
      }

      console.log("[v0] Successfully completed pending transaction:", transactionId)
      return { success: true }
    } catch (error) {
      console.error("[v0] Exception in completePendingTransaction:", error)
      return { success: false, error: "Internal error during transaction completion" }
    }
  }

  async cancelPendingTransaction(
    transactionId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await this.getAdminSupabase()

    try {
      const { data: transaction, error: fetchError } = await supabase
        .from("pending_transactions")
        .select("*")
        .eq("id", transactionId)
        .eq("status", "pending")
        .single()

      if (fetchError || !transaction) {
        return { success: false, error: "Transaction not found or already processed" }
      }

      const { data: userProfile, error: profileFetchError } = await supabase
        .from("user_profiles")
        .select("id, email, available_balance, reserved_balance")
        .eq("id", transaction.user_id)
        .single()

      if (profileFetchError || !userProfile) {
        return { success: false, error: "Failed to fetch user profile" }
      }

      const userEmail = userProfile.email

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          available_balance: (Number(userProfile.available_balance) || 0) + transaction.amount,
          reserved_balance: Math.max(0, (Number(userProfile.reserved_balance) || 0) - transaction.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userProfile.id)

      if (updateError) {
        return { success: false, error: "Failed to refund transaction" }
      }

      const { error: transactionUpdateError } = await supabase
        .from("pending_transactions")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          metadata: { ...transaction.metadata, failure_reason: reason },
        })
        .eq("id", transactionId)

      if (transactionUpdateError) {
        console.error("[v0] Error updating transaction status:", transactionUpdateError)
      }

      return { success: true }
    } catch (error) {
      console.error("[v0] Error canceling transaction:", error)
      return { success: false, error: "Internal error during transaction cancellation" }
    }
  }

  async addFunds(
    userEmail: string,
    amount: number,
    description: string,
    metadata?: any,
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await this.getAdminSupabase()

    try {
      console.log("[v0] Processing addFunds for user:", userEmail, "amount:", amount)

      let { data: currentProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, email, available_balance")
        .eq("email", userEmail)
        .maybeSingle()

      if (profileError) {
        console.error("[v0] Error fetching profile by email:", profileError)
        return { success: false, error: "Failed to fetch user profile" }
      }

      if (!currentProfile) {
        console.log("[v0] No profile found, creating one for addFunds...")
        const createResult = await this.createUserProfile(userEmail)

        if (!createResult.success) {
          console.error("[v0] Failed to create user profile for addFunds:", createResult.error)
          return { success: false, error: `Failed to create user profile: ${createResult.error}` }
        }

        // Fetch the newly created profile
        const { data: newProfile, error: newProfileError } = await supabase
          .from("user_profiles")
          .select("id, email, available_balance")
          .eq("email", userEmail)
          .maybeSingle()

        if (newProfileError || !newProfile) {
          console.error("[v0] Failed to fetch newly created profile:", newProfileError)
          return { success: false, error: "Failed to fetch newly created user profile" }
        }

        currentProfile = newProfile
      }

      console.log("[v0] Using profile for addFunds:", {
        email: currentProfile.email,
        balance: currentProfile.available_balance,
      })

      const newBalance = (Number(currentProfile.available_balance) || 0) + amount

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          available_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("email", userEmail)

      if (updateError) {
        console.error("[v0] Error updating balance:", updateError)
        return { success: false, error: "Failed to add funds" }
      }

      console.log("[v0] Creating wallet transaction record with type: top_up")
      const { error: transactionError } = await supabase.from("wallet_transactions").insert({
        user_id: currentProfile.id,
        transaction_type: "top_up",
        amount: amount,
        description: description,
        balance_before: Number(currentProfile.available_balance) || 0,
        balance_after: newBalance,
        metadata: { ...metadata, user_email: userEmail },
      })

      if (transactionError) {
        console.error("[v0] Error creating transaction record:", transactionError)
      }

      console.log("[v0] Successfully added funds:", amount, "to user:", userEmail)
      return { success: true }
    } catch (error) {
      console.error("[v0] Error adding funds:", error)
      return { success: false, error: "Internal error during fund addition" }
    }
  }

  async getTransactionHistory(userEmail: string, limit = 50): Promise<any[]> {
    const supabase = await this.getAdminSupabase()

    try {
      console.log("[v0] Fetching transaction history for user:", userEmail)

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle()

      if (profileError) {
        console.error("[v0] Error fetching user profile for transaction history:", profileError)
        return []
      }

      if (!profile) {
        console.log("[v0] No user profile found for transaction history")
        return []
      }

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) {
        console.error("[v0] Error fetching transaction history:", error)
        return []
      }

      return data || []
    } catch (error) {
      console.error("[v0] Exception in getTransactionHistory:", error)
      return []
    }
  }

  async getPendingTransactions(userEmail: string): Promise<PendingTransaction[]> {
    const supabase = await this.getAdminSupabase()

    try {
      console.log("[v0] Fetching pending transactions for user:", userEmail)

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle()

      if (profileError) {
        console.error("[v0] Error fetching user profile for pending transactions:", profileError)
        return []
      }

      if (!profile) {
        console.log("[v0] No user profile found for pending transactions")
        return []
      }

      const { data, error } = await supabase
        .from("pending_transactions")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching pending transactions:", error)
        return []
      }

      return (data || []).map((transaction) => ({
        ...transaction,
        user_email: userEmail,
      }))
    } catch (error) {
      console.error("[v0] Exception in getPendingTransactions:", error)
      return []
    }
  }

  async findStalePendingTransactions(userEmail?: string, ageInMinutes?: number): Promise<any[]> {
    const supabase = await this.getAdminSupabase()

    try {
      if (userEmail && ageInMinutes) {
        // Original method for specific user and age
        console.log(
          "[v0] Finding stale pending transactions for user:",
          userEmail,
          "older than",
          ageInMinutes,
          "minutes",
        )

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle()

        if (profileError || !profile) {
          console.error("[v0] Error fetching user profile for stale transactions:", profileError)
          return []
        }

        const cutoffTime = new Date(Date.now() - ageInMinutes * 60 * 1000).toISOString()

        const { data, error } = await supabase
          .from("pending_transactions")
          .select("*")
          .eq("user_id", profile.id)
          .eq("status", "pending")
          .lt("created_at", cutoffTime)
          .order("created_at", { ascending: true })

        if (error) {
          console.error("[v0] Error fetching stale pending transactions:", error)
          return []
        }

        console.log("[v0] Found", data?.length || 0, "stale pending transactions")
        return data || []
      } else {
        console.log("[v0] Finding all pending transactions for polling")

        // First, get all pending transactions
        const { data: pendingTransactions, error: transactionError } = await supabase
          .from("pending_transactions")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true })

        if (transactionError) {
          console.error("[v0] Error fetching all pending transactions:", transactionError)
          return []
        }

        if (!pendingTransactions || pendingTransactions.length === 0) {
          console.log("[v0] No pending transactions found")
          return []
        }

        // Get unique user IDs
        const userIds = [...new Set(pendingTransactions.map((t) => t.user_id))]

        // Fetch user profiles separately
        const { data: userProfiles, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, email")
          .in("id", userIds)

        if (profileError) {
          console.error("[v0] Error fetching user profiles:", profileError)
          return []
        }

        // Create a map of user_id to email
        const userEmailMap = new Map()
        userProfiles?.forEach((profile) => {
          userEmailMap.set(profile.id, profile.email)
        })

        // Combine the data
        const result = pendingTransactions.map((transaction) => ({
          ...transaction,
          user_email: userEmailMap.get(transaction.user_id) || "unknown",
        }))

        console.log("[v0] Found", result.length, "pending transactions for polling")
        return result
      }
    } catch (error) {
      console.error("[v0] Exception in findStalePendingTransactions:", error)
      return []
    }
  }

  async updatePendingTransactionMetadata(
    transactionId: string,
    metadata: any,
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await this.getAdminSupabase()

    try {
      console.log("[v0] Updating pending transaction metadata for ID:", transactionId)

      const { data: transaction, error: fetchError } = await supabase
        .from("pending_transactions")
        .select("metadata")
        .eq("id", transactionId)
        .eq("status", "pending")
        .single()

      if (fetchError || !transaction) {
        console.error("[v0] Error fetching pending transaction for metadata update:", fetchError)
        return { success: false, error: "Transaction not found or already processed" }
      }

      const updatedMetadata = { ...transaction.metadata, ...metadata }

      const { error: updateError } = await supabase
        .from("pending_transactions")
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)

      if (updateError) {
        console.error("[v0] Error updating transaction metadata:", updateError)
        return { success: false, error: "Failed to update transaction metadata" }
      }

      console.log("[v0] Successfully updated transaction metadata for:", transactionId)
      return { success: true }
    } catch (error) {
      console.error("[v0] Exception in updatePendingTransactionMetadata:", error)
      return { success: false, error: "Internal error during metadata update" }
    }
  }

  private async createUserProfile(userEmail: string): Promise<{ success: boolean; error?: string }> {
    console.log("[v0] Starting user profile creation for:", userEmail)
    const supabase = await this.getAdminSupabase()

    try {
      const { data: existingProfile, error: checkError } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle()

      if (checkError) {
        console.error("[v0] Error checking existing profile:", checkError)
        return { success: false, error: "Failed to check existing profile" }
      }

      if (existingProfile) {
        console.log("[v0] User profile already exists for:", userEmail)
        return { success: true }
      }

      console.log("[v0] Checking if auth user exists for:", userEmail)
      const {
        data: { users },
        error: listError,
      } = await supabase.auth.admin.listUsers()

      if (listError) {
        console.error("[v0] Error listing auth users:", listError)
        return { success: false, error: "Failed to check auth users" }
      }

      let authUserId: string | null = null
      const existingAuthUser = users?.find((u) => u.email === userEmail)

      if (existingAuthUser) {
        console.log("[v0] Auth user already exists with ID:", existingAuthUser.id)
        authUserId = existingAuthUser.id
      } else {
        console.log("[v0] Creating auth user for:", userEmail)
        const {
          data: { user: newAuthUser },
          error: createAuthError,
        } = await supabase.auth.admin.createUser({
          email: userEmail,
          email_confirm: true, // Auto-confirm email to avoid verification flow
          user_metadata: {
            created_via: "wallet_service",
          },
        })

        if (createAuthError || !newAuthUser) {
          console.error("[v0] Error creating auth user:", createAuthError)
          return { success: false, error: `Failed to create auth user: ${createAuthError?.message}` }
        }

        console.log("[v0] Successfully created auth user with ID:", newAuthUser.id)
        authUserId = newAuthUser.id
      }

      console.log("[v0] Creating user profile with auth user ID:", authUserId)
      const { error } = await supabase.from("user_profiles").insert({
        id: authUserId, // Use auth user's ID instead of random UUID
        email: userEmail,
        available_balance: 0,
        reserved_balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        console.error("[v0] Error creating user profile:", error)
        return { success: false, error: `Failed to insert user profile: ${error.message}` }
      }

      console.log("[v0] Successfully created user profile for:", userEmail)
      return { success: true }
    } catch (error) {
      console.error("[v0] Exception in createUserProfile:", error)
      return { success: false, error: `Internal error during profile creation: ${error}` }
    }
  }
}

export const walletService = new WalletService()
