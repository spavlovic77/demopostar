# QR Payment & Real-Time Billing System Documentation

## Complete Implementation Guide for AI LLM Coding Assistants

This document provides comprehensive technical specifications for implementing a pre-paid balance system with QR code payment functionality and real-time payment notifications via MQTT.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Frontend Components](#5-frontend-components)
6. [External Services Integration](#6-external-services-integration)
7. [Payment Flow Diagrams](#7-payment-flow-diagrams)
8. [Implementation Steps](#8-implementation-steps)
9. [Security Considerations](#9-security-considerations)
10. [Environment Variables](#10-environment-variables)

---

## 1. System Overview

### Core Concept

This system implements a **pre-paid wallet** where users must maintain a positive balance to use services. Users top up their wallet by scanning a QR code with their banking app, and the system receives real-time payment confirmation via MQTT protocol.

### Key Features

- **Pre-paid Balance**: Users have available and reserved balance
- **QR Code Payments**: Generate Slovak PayMe.sk compatible QR codes
- **Real-Time Notifications**: MQTT subscription for instant payment confirmation
- **Transaction History**: Complete audit trail of all wallet operations
- **Fund Reservation**: Reserve funds before service usage, complete/refund after

### Technology Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Backend**: Next.js API Routes (serverless functions)
- **Database**: PostgreSQL (via Supabase)
- **Real-Time**: MQTT over TLS (mqtts://)
- **Payment Gateway**: PayMe.sk (Slovak banking QR standard)
- **External API**: mTLS authenticated API for transaction ID generation

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ WalletManagement│  │ PaymentLinkView │  │  Balance Display │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                        │
└───────────┼────────────────────┼────────────────────┼────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTES (Next.js)                               │
│  ┌──────────────┐ ┌────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │/api/wallet/  │ │/api/wallet/    │ │/api/wallet/     │ │/api/wallet/   │ │
│  │balance       │ │payment-link    │ │payment-         │ │process-       │ │
│  │              │ │                │ │notification     │ │payment        │ │
│  └──────┬───────┘ └───────┬────────┘ └────────┬────────┘ └───────┬───────┘ │
│         │                 │                   │                   │         │
└─────────┼─────────────────┼───────────────────┼───────────────────┼─────────┘
          │                 │                   │                   │
          ▼                 ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WALLET SERVICE (lib/wallet.ts)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ getBalance  │ │reserveFunds │ │ addFunds    │ │getTransactionHistory    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (PostgreSQL/Supabase)                        │
│  ┌─────────────────┐ ┌─────────────────────┐ ┌───────────────────────────┐  │
│  │ user_profiles   │ │ wallet_transactions │ │ pending_transactions      │  │
│  │ (balance data)  │ │ (transaction log)   │ │ (reserved funds)          │  │
│  └─────────────────┘ └─────────────────────┘ └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│  ┌─────────────────────────┐     ┌──────────────────────────────────────┐   │
│  │ Transaction ID API      │     │ MQTT Broker (Payment Notifications)  │   │
│  │ (mTLS authenticated)    │     │ Topic: VATSK-{ico}/POKLADNICA-{id}/  │   │
│  │ POST /generateNewTxnId  │     │        {transactionId}               │   │
│  └─────────────────────────┘     └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `WalletManagement` | Main wallet UI - balance display, top-up form, transaction history |
| `PaymentLinkView` | QR code display, payment link generation, real-time status |
| `WalletService` | Business logic for all wallet operations |
| `payment-link API` | Generate unique transaction IDs via external mTLS API |
| `payment-notification API` | Subscribe to MQTT for real-time payment confirmation |
| `process-payment API` | Credit funds to user wallet after confirmation |

---

## 3. Database Schema

### Table: `user_profiles`

Stores user account information and wallet balance.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  organization_name TEXT,
  organization_id TEXT,
  peppol_identifier TEXT,
  available_balance NUMERIC(10,2) DEFAULT 0.00,
  reserved_balance NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select_own ON user_profiles
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY user_profiles_update_own ON user_profiles
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY user_profiles_insert_own ON user_profiles
  FOR INSERT WITH CHECK (auth.uid()::text = id::text);
```

**Balance Types:**
- `available_balance`: Funds user can spend immediately
- `reserved_balance`: Funds reserved for pending operations (e.g., document sending)
- `total_balance` = `available_balance` + `reserved_balance` (computed)

### Table: `wallet_transactions`

Audit log of all balance changes.

```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'credit', 'debit', 'top_up'
  amount NUMERIC(10,2) NOT NULL,
  balance_before NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2) NOT NULL,
  description TEXT,
  reference_id UUID, -- Links to pending_transactions if applicable
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_created ON wallet_transactions(created_at DESC);

-- RLS Policies
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_transactions_select_own ON wallet_transactions
  FOR SELECT USING (user_id IN (
    SELECT id FROM user_profiles WHERE email = auth.jwt()->>'email'
  ));

CREATE POLICY wallet_transactions_insert_own ON wallet_transactions
  FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM user_profiles WHERE email = auth.jwt()->>'email'
  ));
```

### Table: `pending_transactions`

Tracks funds reserved for operations in progress.

```sql
CREATE TABLE pending_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  transaction_type TEXT NOT NULL, -- 'send_document', 'top_up'
  ion_ap_transaction_id TEXT, -- External system reference
  metadata JSONB,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pending_transactions_user ON pending_transactions(user_id);
CREATE INDEX idx_pending_transactions_status ON pending_transactions(status);

-- RLS Policies
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_transactions_select_own ON pending_transactions
  FOR SELECT USING (user_id IN (
    SELECT id FROM user_profiles WHERE email = auth.jwt()->>'email'
  ));
```

### Table: `pricing_config`

Service pricing configuration.

```sql
CREATE TABLE pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL, -- e.g., 'document_send'
  price_per_transaction NUMERIC(10,4) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example pricing
INSERT INTO pricing_config (service_type, price_per_transaction, currency)
VALUES ('document_send', 0.04, 'EUR');
```

---

## 4. API Endpoints

### 4.1 GET `/api/wallet/balance`

Returns current user wallet balance.

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "available_balance": 10.50,
  "reserved_balance": 0.04,
  "total_balance": 10.54
}
```

**Implementation:**
```typescript
// app/api/wallet/balance/route.ts
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { ServerAuthService } = await import("@/lib/auth-server")
  const { walletService } = await import("@/lib/wallet")

  const user = await ServerAuthService.getUserFromRequest(request)
  
  if (!user) {
    return NextResponse.json({
      available_balance: 0,
      reserved_balance: 0,
      total_balance: 0,
    })
  }

  const balance = await walletService.getBalance(user.email)
  return NextResponse.json(balance)
}
```

### 4.2 POST `/api/wallet/payment-link`

Generates a unique transaction ID for QR payment.

**Request:**
```json
{
  "amount": 0.50
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "QR-abc123xyz",
  "amount": 0.50,
  "message": "Payment link generated successfully"
}
```

**Implementation (with mTLS external API):**
```typescript
// app/api/wallet/payment-link/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { writeFile, unlink } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

async function getTransactionIdFromExternalAPI(): Promise<string | null> {
  const certPath = process.env.KV_CERT_PATH
  const keyPath = process.env.KV_KEY_PATH
  const caPath = process.env.KV_CA_BUNDLE_PATH

  if (!certPath || !keyPath || !caPath) {
    throw new Error("Certificate paths not configured")
  }

  // Read and validate certificates (base64 decode if needed)
  const clientCert = await readCertificateFile(certPath, "certificate")
  const clientKey = await readCertificateFile(keyPath, "key")
  const caCert = await readCertificateFile(caPath, "ca")

  // Write to temp files
  const tempDir = tmpdir()
  const certFile = join(tempDir, "cert.pem")
  const keyFile = join(tempDir, "key.pem")
  const caFile = join(tempDir, "ca.pem")

  await Promise.all([
    writeFile(certFile, clientCert, { mode: 0o600 }),
    writeFile(keyFile, clientKey, { mode: 0o600 }),
    writeFile(caFile, caCert, { mode: 0o600 }),
  ])

  try {
    const { stdout } = await execAsync(
      `curl -s -S -i -X POST https://your-api.example.com/api/v1/generateNewTransactionId \
       --cert "${certFile}" --key "${keyFile}" --cacert "${caFile}" --insecure`,
      { timeout: 30000 }
    )

    // Parse response
    const parts = stdout.split(/\r?\n\r?\n/)
    const body = parts.slice(1).join("\n\n").trim()
    const data = JSON.parse(body)
    
    return data.transaction_id
  } finally {
    // Cleanup temp files
    await Promise.allSettled([
      unlink(certFile),
      unlink(keyFile),
      unlink(caFile),
    ])
  }
}

export async function POST(request: NextRequest) {
  const { ServerAuthService } = await import("@/lib/auth-server")

  const user = await ServerAuthService.getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { amount } = await request.json()
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
  }

  const transactionId = await getTransactionIdFromExternalAPI()

  return NextResponse.json({
    success: true,
    transactionId,
    amount,
    message: "Payment link generated successfully",
  })
}
```

### 4.3 POST `/api/wallet/payment-notification`

Subscribes to MQTT broker and waits for payment confirmation.

**Request:**
```json
{
  "transactionId": "QR-abc123xyz"
}
```

**Response (on payment received):**
```json
{
  "success": true,
  "notification": {
    "transactionAmount": {
      "amount": "0.50",
      "currency": "EUR"
    },
    "endToEndId": "QR-abc123xyz",
    "parsedTopic": {
      "vatsk": "12345678",
      "pokladnica": "123456789012345",
      "endToEndId": "QR-abc123xyz"
    }
  }
}
```

**Implementation (MQTT subscription):**
```typescript
// app/api/wallet/payment-notification/route.ts
import type { NextRequest } from "next/server"
import mqtt from "mqtt"
import crypto from "crypto"

function extractVATSKandPOKLADNICA(certPem: string) {
  const cert = new crypto.X509Certificate(certPem)
  const subject = cert.subject
  
  // Extract from subject: CN=VATSK-12345678 POKLADNICA 123456789012345
  const orgIdMatch = subject.match(/organizationIdentifier=VATSK-(\d+)/)
  const cnMatch = subject.match(/CN=VATSK-\d+\s+POKLADNICA\s+(\d+)/)
  
  return {
    vatsk: orgIdMatch ? orgIdMatch[1] : null,
    pokladnica: cnMatch ? cnMatch[1] : null,
  }
}

async function subscribeMQTT(transactionId: string): Promise<any> {
  const certPem = await readCertificateFile(process.env.KV_CERT_PATH!)
  const keyPem = await readCertificateFile(process.env.KV_KEY_PATH!)
  const caPem = await readCertificateFile(process.env.KV_CA_BUNDLE_PATH!)

  const { vatsk, pokladnica } = extractVATSKandPOKLADNICA(certPem)
  
  if (!vatsk || !pokladnica) {
    throw new Error("Could not extract VATSK/POKLADNICA from certificate")
  }

  const mqttTopic = `VATSK-${vatsk}/POKLADNICA-${pokladnica}/${transactionId}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.end()
      resolve(null) // Timeout without payment
    }, 120000) // 2 minute timeout

    const client = mqtt.connect("mqtts://mqtt.your-broker.com:8883", {
      cert: certPem,
      key: keyPem,
      ca: [caPem],
      rejectUnauthorized: false,
      protocol: "mqtts",
      port: 8883,
    })

    client.on("connect", () => {
      client.subscribe(mqttTopic, (err) => {
        if (err) reject(err)
      })
    })

    client.on("message", (topic, message) => {
      clearTimeout(timeout)
      
      const topicParts = topic.split("/")
      const payload = JSON.parse(message.toString())
      
      client.end()
      resolve({
        ...payload,
        parsedTopic: {
          vatsk: topicParts[0].substring(6),
          pokladnica: topicParts[1].substring(11),
          endToEndId: topicParts[2],
        },
      })
    })

    client.on("error", (error) => {
      clearTimeout(timeout)
      client.end()
      reject(error)
    })
  })
}

export async function POST(request: NextRequest) {
  const { transactionId } = await request.json()

  if (!transactionId) {
    return Response.json({ error: "Transaction ID required" }, { status: 400 })
  }

  const notification = await subscribeMQTT(transactionId)

  if (notification) {
    return Response.json({ success: true, notification })
  } else {
    return Response.json({ success: false, message: "No payment received" })
  }
}
```

### 4.4 POST `/api/wallet/process-payment`

Credits funds to user wallet after payment confirmation.

**Request:**
```json
{
  "amount": 0.50,
  "transactionId": "QR-abc123xyz",
  "notification": { /* MQTT payload */ }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "amount": 0.50
}
```

**Implementation:**
```typescript
// app/api/wallet/process-payment/route.ts
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { ServerAuthService } = await import("@/lib/auth-server")
  const { walletService } = await import("@/lib/wallet")

  const user = await ServerAuthService.getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { amount, transactionId, notification } = await request.json()

  if (!amount || amount <= 0 || !transactionId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = await walletService.addFunds(
    user.email,
    amount,
    `Top-up via QR - ${transactionId}`,
    {
      type: "bank_transfer_qr",
      transaction_id: transactionId,
      notification,
      processed_at: new Date().toISOString(),
    }
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    message: "Payment processed successfully",
    amount,
  })
}
```

### 4.5 GET `/api/wallet/transactions`

Returns transaction history and pending transactions.

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "transaction_type": "credit",
      "amount": 0.50,
      "description": "Top-up via QR - QR-abc123",
      "balance_before": 0.00,
      "balance_after": 0.50,
      "created_at": "2024-01-15T10:30:00Z",
      "metadata": {}
    }
  ],
  "pending_transactions": []
}
```

---

## 5. Frontend Components

### 5.1 WalletManagement Component

Main wallet interface with balance display and top-up functionality.

```typescript
// components/wallet-management.tsx
"use client"

import { useState, useEffect } from "react"
import { PaymentLinkView } from "./payment-link-view"

interface WalletBalance {
  available_balance: number
  reserved_balance: number
  total_balance: number
}

export function WalletManagement({ onBalanceUpdate }: { onBalanceUpdate?: () => void }) {
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [topUpAmount, setTopUpAmount] = useState("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)

  useEffect(() => {
    loadWalletData()
    
    // Detect mobile device
    const userAgent = navigator.userAgent.toLowerCase()
    setIsMobileDevice(/iphone|ipad|ipod|android/.test(userAgent))
  }, [])

  const loadWalletData = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return

    const response = await fetch("/api/wallet/balance", {
      headers: { Authorization: `Bearer ${token}` },
    })
    
    if (response.ok) {
      setBalance(await response.json())
    }
  }

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount)
    if (amount >= 0.05 && amount <= 100) {
      setShowPaymentModal(true)
    }
  }

  const handleMobilePayment = async () => {
    const amount = parseFloat(topUpAmount)
    const token = localStorage.getItem("access_token")
    
    // Generate transaction ID
    const response = await fetch("/api/wallet/payment-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    })

    const { transactionId } = await response.json()

    // Construct PayMe.sk link
    const dueDate = new Date().toISOString().slice(0,10).replace(/-/g, "")
    const params = new URLSearchParams({
      V: "1",
      IBAN: "SK7811000000002944276572", // Your IBAN
      AM: amount.toFixed(2),
      CC: "EUR",
      PI: transactionId, // Payment Identifier (endToEndId)
      DT: dueDate,
      MSG: "Account top-up",
      CN: "Your Company Name",
    })

    // Navigate to payment link (opens banking app on mobile)
    window.location.href = `https://payme.sk/?${params.toString()}`

    // Start listening for notification in background
    listenForPayment(transactionId, amount)
  }

  const listenForPayment = async (txnId: string, amount: number) => {
    const token = localStorage.getItem("access_token")
    
    const response = await fetch("/api/wallet/payment-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ transactionId: txnId }),
    })

    const data = await response.json()

    if (data.success && data.notification) {
      // Process payment
      await fetch("/api/wallet/process-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          transactionId: txnId,
          notification: data.notification,
        }),
      })

      // Refresh balance
      loadWalletData()
      onBalanceUpdate?.()
    }
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-muted-foreground">Available</p>
          <p className="text-2xl font-bold text-green-600">
            €{balance?.available_balance.toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-muted-foreground">Reserved</p>
          <p className="text-2xl font-bold text-yellow-600">
            €{balance?.reserved_balance.toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-blue-600">
            €{balance?.total_balance.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>

      {/* Top-up Form */}
      <div className="p-6 border rounded-lg">
        <h3 className="font-semibold mb-4">Top Up Balance</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(e.target.value)}
            placeholder="Amount (€)"
            min="0.05"
            step="0.01"
            className="flex-1 px-3 py-2 border rounded"
          />
          {isMobileDevice ? (
            <button onClick={handleMobilePayment} className="px-4 py-2 bg-blue-600 text-white rounded">
              Pay with Bank App
            </button>
          ) : (
            <button onClick={handleTopUp} className="px-4 py-2 bg-primary text-white rounded">
              Generate QR Code
            </button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <PaymentLinkView
              amount={parseFloat(topUpAmount)}
              onClose={() => setShowPaymentModal(false)}
              onPaymentSuccess={() => {
                loadWalletData()
                onBalanceUpdate?.()
                setShowPaymentModal(false)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
```

### 5.2 PaymentLinkView Component

QR code display with real-time payment status.

```typescript
// components/payment-link-view.tsx
"use client"

import { useState, useEffect, useRef } from "react"

interface PaymentLinkViewProps {
  amount: number
  onClose: () => void
  onPaymentSuccess?: () => void
}

export function PaymentLinkView({ amount, onClose, onPaymentSuccess }: PaymentLinkViewProps) {
  const [deviceType, setDeviceType] = useState<"desktop" | "mobile" | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [paymentReceived, setPaymentReceived] = useState(false)
  const hasGeneratedRef = useRef(false)

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    setDeviceType(/iphone|ipad|ipod|android/.test(userAgent) ? "mobile" : "desktop")
  }, [])

  useEffect(() => {
    if (deviceType && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true
      generatePaymentLink()
    }
  }, [deviceType])

  const generatePaymentLink = async () => {
    setIsLoading(true)
    const token = localStorage.getItem("access_token")

    // Get transaction ID from API
    const response = await fetch("/api/wallet/payment-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount }),
    })

    const { transactionId: txnId } = await response.json()
    setTransactionId(txnId)

    // Construct PayMe.sk link
    const linkUrl = constructPaymentLink(txnId, amount)
    setPaymentLink(linkUrl)

    // Generate QR code for desktop
    if (deviceType === "desktop") {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(linkUrl)}`
      setQrCodeUrl(qrUrl)
    }

    setIsLoading(false)

    // Start listening for payment
    listenForPayment(txnId)
  }

  const constructPaymentLink = (endToEndId: string, amountEUR: number): string => {
    const dueDate = new Date().toISOString().slice(0,10).replace(/-/g, "")
    
    const params = new URLSearchParams({
      V: "1",                              // Version
      IBAN: "SK7811000000002944276572",   // Your bank account IBAN
      AM: amountEUR.toFixed(2),           // Amount
      CC: "EUR",                          // Currency
      PI: endToEndId,                     // Payment Identifier (unique per transaction)
      DT: dueDate,                        // Due date (YYYYMMDD)
      MSG: "Account top-up",              // Message/Note
      CN: "Your Company Name",            // Creditor name
    })

    return `https://payme.sk/?${params.toString()}`
  }

  const listenForPayment = async (txnId: string) => {
    setIsListening(true)
    const token = localStorage.getItem("access_token")

    const response = await fetch("/api/wallet/payment-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ transactionId: txnId }),
    })

    const data = await response.json()
    setIsListening(false)

    if (data.success && data.notification) {
      // Payment received!
      setPaymentReceived(true)
      await processPayment(txnId, data.notification)
    }
  }

  const processPayment = async (txnId: string, notification: any) => {
    const token = localStorage.getItem("access_token")

    await fetch("/api/wallet/process-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        transactionId: txnId,
        notification,
      }),
    })

    onPaymentSuccess?.()
  }

  if (isLoading) {
    return <div className="text-center p-8">Generating payment...</div>
  }

  if (paymentReceived) {
    return (
      <div className="text-center p-8">
        <div className="text-green-600 text-6xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-green-600">Payment Received!</h2>
        <p className="text-muted-foreground mt-2">
          €{amount.toFixed(2)} has been added to your account.
        </p>
        <button onClick={onClose} className="mt-4 px-6 py-2 bg-primary text-white rounded">
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Amount Display */}
      <div className="text-center p-4 bg-primary/5 rounded-lg">
        <p className="text-sm text-muted-foreground">Amount to pay</p>
        <p className="text-4xl font-bold">€{amount.toFixed(2)}</p>
      </div>

      {/* Real-time Status */}
      {isListening && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span>Waiting for payment confirmation...</span>
        </div>
      )}

      {/* QR Code (Desktop) */}
      {deviceType === "desktop" && qrCodeUrl && (
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-xl shadow-lg">
            <img src={qrCodeUrl} alt="Payment QR Code" className="w-64 h-64" />
            <p className="text-center text-sm text-muted-foreground mt-2">
              Scan with your banking app
            </p>
          </div>
        </div>
      )}

      {/* Payment Link Button (Mobile) */}
      {deviceType === "mobile" && paymentLink && (
        <a
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full p-4 bg-blue-600 text-white text-center rounded-lg font-semibold"
        >
          Open Banking App
        </a>
      )}

      <button onClick={onClose} className="w-full p-2 text-muted-foreground">
        Cancel
      </button>
    </div>
  )
}
```

---

## 6. External Services Integration

### 6.1 Transaction ID Generation API (mTLS)

The system requires a unique transaction ID from an external API authenticated via mutual TLS.

**Certificate Requirements:**
- Client Certificate (PEM format)
- Client Private Key (PEM format)
- CA Bundle (PEM format)

**Certificate Storage Options:**
1. Base64-encoded in environment variables
2. File paths (for local development)
3. Secrets management (Vault, AWS Secrets Manager)

**Certificate Validation Helper:**
```typescript
function validateAndNormalizePEM(pemContent: string, type: string): string {
  const normalized = pemContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  
  // Remove metadata
  const cleaned = normalized
    .split("\n")
    .filter(line => 
      !line.startsWith("Bag Attributes") && 
      !line.startsWith("subject=") && 
      !line.startsWith("issuer=")
    )
    .join("\n")

  // Find markers
  let beginMarker: string
  let endMarker: string

  if (type === "certificate" || type === "ca") {
    beginMarker = "-----BEGIN CERTIFICATE-----"
    endMarker = "-----END CERTIFICATE-----"
  } else if (type === "key") {
    // Detect key type
    if (cleaned.includes("-----BEGIN RSA PRIVATE KEY-----")) {
      beginMarker = "-----BEGIN RSA PRIVATE KEY-----"
      endMarker = "-----END RSA PRIVATE KEY-----"
    } else if (cleaned.includes("-----BEGIN PRIVATE KEY-----")) {
      beginMarker = "-----BEGIN PRIVATE KEY-----"
      endMarker = "-----END PRIVATE KEY-----"
    } else {
      throw new Error("Invalid private key format")
    }
  }

  const beginIndex = cleaned.indexOf(beginMarker!)
  const endIndex = cleaned.indexOf(endMarker!) + endMarker!.length
  
  return cleaned.substring(beginIndex, endIndex).trim()
}
```

### 6.2 MQTT Broker Configuration

**Connection Parameters:**
- Protocol: `mqtts://` (MQTT over TLS)
- Port: `8883`
- Authentication: Client certificates

**Topic Structure:**
```
VATSK-{company_vat_id}/POKLADNICA-{terminal_id}/{transaction_id}
```

Example: `VATSK-12345678/POKLADNICA-123456789012345/QR-abc123xyz`

**Message Payload:**
```json
{
  "transactionAmount": {
    "amount": "0.50",
    "currency": "EUR"
  },
  "endToEndId": "QR-abc123xyz",
  "creditorAccount": {
    "iban": "SK7811000000002944276572"
  },
  "debtorAccount": {
    "iban": "SK..."
  },
  "bookingDate": "2024-01-15",
  "valueDate": "2024-01-15"
}
```

### 6.3 PayMe.sk QR Code Standard

Slovak banking QR code standard for instant payments.

**URL Structure:**
```
https://payme.sk/?V=1&IBAN={iban}&AM={amount}&CC={currency}&PI={payment_id}&DT={due_date}&MSG={message}&CN={creditor_name}
```

**Parameters:**
| Parameter | Description | Required | Example |
|-----------|-------------|----------|---------|
| V | Version | Yes | `1` |
| IBAN | Recipient bank account | Yes | `SK7811000000002944276572` |
| AM | Amount (2 decimal places) | Yes | `0.50` |
| CC | Currency code | Yes | `EUR` |
| PI | Payment Identifier (endToEndId) | Yes | `QR-abc123xyz` |
| DT | Due date (YYYYMMDD) | No | `20240115` |
| MSG | Payment message | No | `Account top-up` |
| CN | Creditor name | No | `Your Company` |

---

## 7. Payment Flow Diagrams

### 7.1 Desktop Flow (QR Code)

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  User   │     │  Frontend   │     │   Backend   │     │ External │
└────┬────┘     └──────┬──────┘     └──────┬──────┘     └────┬─────┘
     │                 │                   │                  │
     │ 1. Enter amount │                   │                  │
     │────────────────>│                   │                  │
     │                 │                   │                  │
     │                 │ 2. POST /payment-link               │
     │                 │──────────────────>│                  │
     │                 │                   │                  │
     │                 │                   │ 3. Get txn ID (mTLS)
     │                 │                   │─────────────────>│
     │                 │                   │                  │
     │                 │                   │<─────────────────│
     │                 │                   │   4. txnId       │
     │                 │<──────────────────│                  │
     │                 │   5. transactionId                   │
     │                 │                   │                  │
     │ 6. Display QR   │                   │                  │
     │<────────────────│                   │                  │
     │                 │                   │                  │
     │                 │ 7. POST /payment-notification        │
     │                 │──────────────────>│                  │
     │                 │                   │                  │
     │                 │                   │ 8. Subscribe MQTT │
     │                 │                   │─────────────────>│
     │                 │                   │                  │
     │ 9. Scan QR with │                   │                  │
     │    banking app  │                   │                  │
     │                 │                   │                  │
     │ 10. Confirm     │                   │                  │
     │     payment     │                   │                  │
     │                 │                   │                  │
     │                 │                   │<─────────────────│
     │                 │                   │ 11. MQTT message │
     │                 │<──────────────────│                  │
     │                 │ 12. notification   │                  │
     │                 │                   │                  │
     │                 │ 13. POST /process-payment            │
     │                 │──────────────────>│                  │
     │                 │                   │                  │
     │                 │                   │ 14. Add funds to │
     │                 │                   │     wallet       │
     │                 │<──────────────────│                  │
     │                 │   15. success     │                  │
     │                 │                   │                  │
     │ 16. Show success│                   │                  │
     │<────────────────│                   │                  │
     │                 │                   │                  │
```

### 7.2 Mobile Flow (Deep Link)

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  User   │     │  Frontend   │     │   Backend   │     │ Banking  │
└────┬────┘     └──────┬──────┘     └──────┬──────┘     │   App    │
     │                 │                   │            └────┬─────┘
     │ 1. Tap "Pay"    │                   │                 │
     │────────────────>│                   │                 │
     │                 │                   │                 │
     │                 │ 2. Generate link  │                 │
     │                 │──────────────────>│                 │
     │                 │<──────────────────│                 │
     │                 │   3. txnId + link │                 │
     │                 │                   │                 │
     │                 │ 4. window.location = payme.sk/...   │
     │                 │────────────────────────────────────>│
     │                 │                   │                 │
     │                 │ 5. Start background MQTT listener   │
     │                 │──────────────────>│                 │
     │                 │                   │                 │
     │ 6. Banking app opens               │                 │
     │<──────────────────────────────────────────────────────│
     │                 │                   │                 │
     │ 7. Confirm payment                  │                 │
     │────────────────────────────────────────────────────>│
     │                 │                   │                 │
     │                 │                   │<────────────────│
     │                 │                   │ 8. MQTT payment │
     │                 │<──────────────────│    notification │
     │                 │   9. notification │                 │
     │                 │                   │                 │
     │ 10. Return to app (auto)            │                 │
     │────────────────>│                   │                 │
     │                 │                   │                 │
     │ 11. Success!    │                   │                 │
     │<────────────────│                   │                 │
```

---

## 8. Implementation Steps

### Phase 1: Database Setup

1. Create Supabase project or PostgreSQL database
2. Run migration scripts to create tables
3. Set up Row Level Security policies
4. Insert default pricing configuration

```sql
-- Run these in order
-- 1. user_profiles table
-- 2. wallet_transactions table
-- 3. pending_transactions table
-- 4. pricing_config table + insert defaults
-- 5. RLS policies
```

### Phase 2: Backend Services

1. **Create WalletService** (`lib/wallet.ts`)
   - Implement `getBalance()`
   - Implement `addFunds()`
   - Implement `reserveFunds()`
   - Implement `completePendingTransaction()`
   - Implement `cancelPendingTransaction()`
   - Implement `getTransactionHistory()`

2. **Create API Routes**
   - `/api/wallet/balance` (GET)
   - `/api/wallet/transactions` (GET)
   - `/api/wallet/payment-link` (POST)
   - `/api/wallet/payment-notification` (POST)
   - `/api/wallet/process-payment` (POST)

3. **Set up mTLS certificate handling**
   - Certificate validation utilities
   - Temp file management for curl calls

4. **Set up MQTT client**
   - Certificate-based authentication
   - Topic subscription logic
   - Payload parsing

### Phase 3: Frontend Components

1. **WalletManagement component**
   - Balance display with animations
   - Top-up form with validation
   - Transaction history list
   - Pending transactions view

2. **PaymentLinkView component**
   - Device detection (mobile/desktop)
   - QR code generation
   - Real-time status updates
   - Success animation

3. **Integration**
   - Add to dashboard layout
   - Connect balance updates globally
   - Add low balance warnings

### Phase 4: Testing

1. **Unit tests**
   - WalletService methods
   - API route handlers
   - Certificate validation

2. **Integration tests**
   - Full payment flow
   - Error handling
   - Timeout scenarios

3. **Manual testing**
   - Desktop QR flow
   - Mobile deep link flow
   - Real payment testing

---

## 9. Security Considerations

### 9.1 Certificate Security

- **Never commit certificates** to version control
- Store certificates as **base64-encoded environment variables**
- Use **temporary files** with restricted permissions (`0o600`)
- **Clean up temp files** immediately after use
- Validate PEM format before use

### 9.2 API Security

- All wallet APIs require **authentication**
- Use **JWT tokens** with short expiration
- Implement **rate limiting** on payment endpoints
- Validate **transaction amounts** server-side
- Check **user ownership** before balance operations

### 9.3 Database Security

- Enable **Row Level Security (RLS)** on all tables
- Users can only access **their own data**
- Use **parameterized queries** (Supabase handles this)
- Audit log all **balance changes**

### 9.4 Payment Security

- **Verify MQTT message** source via topic structure
- Match **transaction ID** between request and notification
- **Validate amounts** match expected values
- Implement **idempotency** to prevent double-processing
- Log all payment events for **audit trail**

---

## 10. Environment Variables

### Required Variables

```env
# Database (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# mTLS Certificates (base64-encoded PEM)
KV_CERT_PATH=LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0t...
KV_KEY_PATH=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0t...
KV_CA_BUNDLE_PATH=LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0t...

# MQTT Broker (if different from certificate-embedded)
MQTT_BROKER_URL=mqtts://mqtt.your-broker.com:8883

# External API (if configurable)
EXTERNAL_API_URL=https://api.your-service.com
```

### Optional Variables

```env
# Wallet Configuration
WALLET_MIN_TOPUP=0.05
WALLET_MAX_TOPUP=100.00
WALLET_LOW_BALANCE_WARNING=0.04

# Payment Configuration
PAYME_IBAN=SK7811000000002944276572
PAYME_CREDITOR_NAME=Your Company Name

# Timeouts
MQTT_TIMEOUT_MS=120000
PAYMENT_LINK_TIMEOUT_MS=30000
```

---

## Summary

This documentation provides a complete blueprint for implementing a pre-paid wallet system with QR code payments and real-time MQTT notifications. The system is designed to be:

- **Secure**: mTLS authentication, RLS policies, JWT tokens
- **Real-time**: MQTT subscriptions for instant payment confirmation
- **User-friendly**: QR codes for desktop, deep links for mobile
- **Auditable**: Complete transaction history with metadata
- **Scalable**: Serverless architecture, efficient database design

For implementation, follow the phases in order and ensure all security measures are in place before going live.
