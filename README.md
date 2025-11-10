# Peppol Document Management System

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/spavlovic77s-projects)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/YrcT2zEMtrf)
[![License: EUPL 1.2](https://img.shields.io/badge/License-EUPL%201.2-blue.svg?style=for-the-badge)](LICENSE.md)

A modern, full-stack web application for managing Peppol BIS documents with integrated wallet management, organization handling, and real-time document tracking.

**GitHub Repository:** [https://github.com/spavlovic77/demopostar](https://github.com/spavlovic77/demopostar)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation Guide](#installation-guide)
- [Configuration](#configuration)
- [Functional Design](#functional-design)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development](#development)
- [Deployment](#deployment)
- [License](#license)
- [Author](#author)

---

## 🎯 Overview

A comprehensive Peppol document exchange platform that enables businesses to send and receive electronic invoices and other business documents through the Peppol network. The system features a prepaid wallet model, multi-organization support, and real-time document tracking.

### What is Peppol?

Peppol (Pan-European Public Procurement On-Line) is an international network for digital business document exchange. It enables businesses to send and receive electronic invoices, orders, and other documents in a standardized format.

---

## ✨ Key Features

### 🔐 Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Secure login with demo credentials for testing
- User profile management with organization associations
- Role-based access control for organization members

### 💰 Wallet Management
- Prepaid wallet system with real-time balance tracking
- Stripe payment integration for wallet top-ups
- Transaction history with detailed metadata
- Automatic fee deduction for document sending
- Pending transaction management with rollback capabilities

### 🏢 Organization Management
- Multi-organization support per user
- Peppol ID management (iso6523-actorid-upis format)
- Organization member management (add/remove users)
- Organization-level access control

### 📄 Document Management
- Send Peppol BIS documents (XML format)
- Receive documents with automatic parsing
- Real-time document status tracking (QUEUED → SENDING → SENT)
- Document polling with MDN (Message Disposition Notification) support
- PDF generation for sent and received documents
- Mark documents as read/unread
- Sample invoice library with drag-and-drop upload

### 🎨 User Experience
- Modern, responsive UI with Tailwind CSS
- Dark mode support with theme switching
- Loading skeletons for better perceived performance
- Collapsible sections for organization users
- Copy-paste functionality for demo credentials
- Real-time balance updates after transactions

---

## 🏗️ Architecture

### High-Level System Design

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Login Form   │  │  Dashboard   │  │  Profile     │          │
│  │              │  │  Layout      │  │  Management  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                 │
│                           │                                       │
│                   ┌───────▼────────┐                            │
│                   │  App Context   │ (Global State)             │
│                   │  - User Data   │                            │
│                   │  - Wallet      │                            │
│                   │  - Orgs        │                            │
│                   └───────┬────────┘                            │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   API Routes    │
                   │   (Next.js)     │
                   └────────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  Authentication │  │   Wallet    │  │  Documents      │
│  Service        │  │   Service   │  │  Management     │
│  (JWT)          │  │  (Supabase) │  │  (ion-AP API)   │
└────────────────┘  └─────────────┘  └─────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Supabase     │
                    │   PostgreSQL   │
                    │                │
                    │  - user_profiles       │
                    │  - wallet_transactions │
                    │  - pending_transactions│
                    │  - pricing_config      │
                    └────────────────┘
\`\`\`

### Data Flow

#### 1. Authentication Flow
\`\`\`
User Login → API Route → ion-AP API → JWT Tokens → localStorage → App Context
\`\`\`

#### 2. Document Sending Flow
\`\`\`
Upload XML → Validate → Reserve Funds (Supabase) → ion-AP API → 
Poll Status → Complete Transaction → Update Balance → Show Receipt
\`\`\`

#### 3. Wallet Top-Up Flow
\`\`\`
Request Payment → Stripe API → Payment Link → User Pays → 
Webhook → Add Funds (Supabase) → Update Balance
\`\`\`

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI + shadcn/ui
- **State Management:** React Context API
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React
- **Fonts:** Geist Sans & Geist Mono

### Backend
- **Runtime:** Next.js API Routes (Edge & Node.js)
- **Authentication:** JWT (ion-AP API)
- **Database:** Supabase (PostgreSQL)
- **Payments:** Stripe
- **External API:** ion-AP (Peppol Access Point)

### DevOps & Tools
- **Hosting:** Vercel
- **Version Control:** Git + GitHub
- **Package Manager:** npm
- **TypeScript:** Type-safe development
- **Analytics:** Vercel Analytics

---

## 📦 Installation Guide

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git**
- A **Vercel account** (for deployment)
- A **Supabase account** (for database)
- A **Stripe account** (for payments, optional)

### Step 1: Clone the Repository

\`\`\`bash
git clone https://github.com/spavlovic77/demopostar.git
cd demopostar
\`\`\`

### Step 2: Install Dependencies

\`\`\`bash
npm install
\`\`\`

This will install all required packages including Next.js, React, Tailwind CSS, Radix UI, and other dependencies.

### Step 3: Set Up Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Add the following environment variables:

\`\`\`env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# PostgreSQL Configuration (from Supabase)
POSTGRES_URL=your_postgres_connection_string
POSTGRES_PRISMA_URL=your_postgres_prisma_connection_string
POSTGRES_URL_NON_POOLING=your_postgres_non_pooling_connection_string
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DATABASE=postgres
POSTGRES_HOST=your_postgres_host

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Development Configuration
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
\`\`\`

### Step 4: Set Up Supabase Database

#### 4.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and API keys

#### 4.2 Run Database Migrations

Execute the following SQL in the Supabase SQL Editor:

\`\`\`sql
-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    available_balance NUMERIC(10, 2) DEFAULT 0,
    reserved_balance NUMERIC(10, 2) DEFAULT 0,
    organization_name TEXT,
    organization_id TEXT,
    peppol_identifier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    balance_before NUMERIC(10, 2),
    balance_after NUMERIC(10, 2),
    reference_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pending_transactions table
CREATE TABLE IF NOT EXISTS public.pending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    transaction_type TEXT NOT NULL,
    ion_ap_transaction_id TEXT,
    metadata JSONB,
    reserved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pricing_config table
CREATE TABLE IF NOT EXISTS public.pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type TEXT NOT NULL,
    price_per_transaction NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default pricing
INSERT INTO public.pricing_config (service_type, price_per_transaction, currency, is_active)
VALUES ('send_document', 0.10, 'EUR', true)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for user_profiles
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_own" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "user_profiles_delete_own" ON public.user_profiles
    FOR DELETE USING (auth.uid() = id);

-- Create RLS Policies for wallet_transactions
CREATE POLICY "wallet_transactions_select_own" ON public.wallet_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "wallet_transactions_insert_own" ON public.wallet_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS Policies for pending_transactions
CREATE POLICY "pending_transactions_select_own" ON public.pending_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pending_transactions_insert_own" ON public.pending_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pending_transactions_update_own" ON public.pending_transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS Policies for pricing_config
CREATE POLICY "pricing_config_select_all" ON public.pricing_config
    FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_transactions_user_id ON public.pending_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_transactions_status ON public.pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
\`\`\`

### Step 5: Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 6: Test with Demo Credentials

Use the demo login credentials provided on the login page:
- **Email:** demo@example.com
- **Password:** demo123

---

## ⚙️ Configuration

### Tailwind CSS Configuration

The application uses Tailwind CSS v4 with custom theme variables. Colors are defined in `app/globals.css`:

\`\`\`css
:root {
  --primary: #7dd3fc; /* Pastel blue */
  --accent: #86efac;  /* Pastel green */
  --destructive: #fca5a5; /* Pastel red */
  /* ... other variables */
}
\`\`\`

### Next.js Configuration

The `next.config.mjs` file contains build and runtime configurations:

\`\`\`javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
  },
}

export default nextConfig
\`\`\`

---

## 📐 Functional Design

### 1. Authentication Module

**Purpose:** Secure user authentication using JWT tokens from the ion-AP API.

**Components:**
- `LoginForm` - User login interface
- `AuthService` - Client-side authentication utilities
- API Routes: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/user-data`

**Flow:**
1. User enters credentials
2. System sends login request to ion-AP API
3. Receives JWT access and refresh tokens
4. Stores tokens in localStorage
5. Fetches user data and loads into App Context
6. Redirects to dashboard

**Security Features:**
- JWT token expiration handling
- Automatic token refresh on 401 errors
- Secure token storage
- Session validation on protected routes

---

### 2. Wallet Management Module

**Purpose:** Prepaid wallet system for managing user funds and transaction fees.

**Components:**
- `WalletManagement` - Wallet dashboard component
- `WalletService` - Backend wallet operations
- Supabase Tables: `user_profiles`, `wallet_transactions`, `pending_transactions`

**Key Functions:**

#### Reserve Funds
\`\`\`typescript
async reserveFunds(
  userEmail: string,
  amount: number,
  transactionType: string,
  metadata?: any
): Promise<{ success: boolean; transactionId?: string }>
\`\`\`

- Checks available balance
- Moves funds from available to reserved
- Creates pending transaction record
- Returns transaction ID for tracking

#### Complete Transaction
\`\`\`typescript
async completePendingTransaction(
  transactionId: string,
  ionApTransactionId?: string
): Promise<{ success: boolean }>
\`\`\`

- Deducts reserved funds
- Updates transaction status to "completed"
- Creates wallet transaction record
- Links to ion-AP transaction ID

#### Cancel Transaction
\`\`\`typescript
async cancelPendingTransaction(
  transactionId: string,
  reason?: string
): Promise<{ success: boolean }>
\`\`\`

- Refunds reserved funds to available balance
- Updates transaction status to "failed"
- Records failure reason in metadata

#### Add Funds
\`\`\`typescript
async addFunds(
  userEmail: string,
  amount: number,
  description: string,
  metadata?: any
): Promise<{ success: boolean }>
\`\`\`

- Increases available balance
- Creates transaction record
- Supports Stripe payment integration

---

### 3. Organization Management Module

**Purpose:** Multi-organization support with Peppol ID management and member access control.

**Components:**
- `UserProfileManagement` - Organization and user management UI
- API Routes: `/api/organizations/*`, `/api/ion-ap/organizations/*`

**Features:**
- List organizations user has access to
- Display Peppol IDs with parsed format
- Add/remove organization members
- Lazy load organization users (collapsible)
- Real-time member list updates

**Peppol ID Format:**
\`\`\`
iso6523-actorid-upis:9950:6878787887
         ↓
    Displayed as: 9950:6878787887
\`\`\`

---

### 4. Document Management Module

**Purpose:** Send and receive Peppol BIS documents with status tracking.

**Components:**
- `SendDocumentForm` - Document upload and sending
- `SentDocumentsView` - View sent documents
- `ReceivedDocumentsView` - View received documents
- `DocumentStateTracker` - Real-time status tracking

**Document Sending Flow:**

\`\`\`
1. Upload XML File
   ↓
2. Validate Peppol BIS Format
   ↓
3. Check Wallet Balance
   ↓
4. Reserve Transaction Fee (0.10 EUR)
   ↓
5. Send to ion-AP API
   ↓
6. Receive Transaction ID
   ↓
7. Poll Document Status (every 3s)
   ├─ QUEUED → continue polling
   ├─ SENDING → continue polling
   ├─ SENT → complete transaction
   └─ ERROR → cancel transaction (refund)
   ↓
8. Update Wallet Balance
   ↓
9. Display Receipt
\`\`\`

**Document States:**
- `QUEUED` - Document accepted, waiting to be sent
- `SENDING` - Document being transmitted
- `SENT` - Document successfully delivered
- `DEFERRED` - Delivery delayed
- `ERROR` - Sending failed

**Sample Invoices:**
- Pre-loaded XML invoice templates
- Drag-and-drop to upload
- Click to select
- Located in `/public/sample-invoices/`

---

### 5. Real-Time Updates Module

**Purpose:** Automatic data synchronization and live updates.

**Components:**
- `AppContext` - Global state management
- Polling mechanisms for document status
- Balance refresh after transactions

**Update Triggers:**
- Document status change → poll every 3 seconds
- Transaction completion → refresh wallet balance
- User/organization changes → refresh context
- Page visibility change → reload data

**Performance Optimizations:**
- Parallel data fetching with Promise.all()
- Skeleton loading states
- Lazy loading for non-critical data
- Debounced refresh functions
- Cached organization data

---

## 🔌 API Documentation

### Authentication Endpoints

#### POST `/api/auth/login`
Login with email and password.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token"
}
\`\`\`

#### POST `/api/auth/refresh`
Refresh access token.

**Request:**
\`\`\`json
{
  "refresh": "jwt_refresh_token"
}
\`\`\`

**Response:**
\`\`\`json
{
  "access": "new_jwt_access_token"
}
\`\`\`

#### GET `/api/auth/user-data`
Get current user data.

**Headers:**
\`\`\`
Authorization: Bearer jwt_access_token
\`\`\`

**Response:**
\`\`\`json
{
  "id": 1,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "is_active": true,
  "organizations": ["Org Name 1", "Org Name 2"]
}
\`\`\`

---

### Wallet Endpoints

#### GET `/api/wallet/balance`
Get user wallet balance.

**Response:**
\`\`\`json
{
  "available_balance": 10.50,
  "reserved_balance": 0.30,
  "total_balance": 10.80
}
\`\`\`

#### GET `/api/wallet/transactions`
Get transaction history.

**Response:**
\`\`\`json
[
  {
    "id": "uuid",
    "transaction_type": "top_up",
    "amount": 10.00,
    "description": "Wallet top-up via Stripe",
    "balance_before": 0.50,
    "balance_after": 10.50,
    "created_at": "2025-01-10T12:00:00Z"
  }
]
\`\`\`

#### POST `/api/wallet/top-up`
Create payment link for wallet top-up.

**Request:**
\`\`\`json
{
  "amount": 10.00
}
\`\`\`

**Response:**
\`\`\`json
{
  "paymentLink": "https://stripe.com/payment/..."
}
\`\`\`

---

### Document Endpoints

#### POST `/api/documents/send`
Send Peppol document.

**Request:**
\`\`\`typescript
FormData {
  file: File (XML),
  senderIdentifier: "9950:1234567890",
  recipientIdentifier: "9950:0987654321"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "transactionId": "uuid",
  "ionApTransactionId": "TXN123456"
}
\`\`\`

#### GET `/api/documents/sent`
Get sent documents.

**Response:**
\`\`\`json
{
  "results": [
    {
      "id": "TXN123",
      "recipient_identifier": "9950:0987654321",
      "state": "SENT",
      "created_at": "2025-01-10T12:00:00Z"
    }
  ]
}
\`\`\`

#### GET `/api/documents/received`
Get received documents.

**Response:**
\`\`\`json
{
  "results": [
    {
      "id": "TXN456",
      "sender_identifier": "9950:1234567890",
      "document_type": "INVOICE",
      "received_at": "2025-01-10T11:30:00Z",
      "is_read": false
    }
  ]
}
\`\`\`

---

### Organization Endpoints

#### GET `/api/organizations/search?name={orgName}`
Search organization by name.

**Response:**
\`\`\`json
{
  "id": 123,
  "name": "Example Org",
  "identifiers": [
    {
      "identifier": "iso6523-actorid-upis:9950:6878787887",
      "scheme": "iso6523-actorid-upis",
      "verified": true
    }
  ]
}
\`\`\`

#### GET `/api/organizations/{id}/users`
Get organization users.

**Response:**
\`\`\`json
{
  "results": [
    {
      "id": 1,
      "email": "user@example.com",
      "is_verified": true
    }
  ]
}
\`\`\`

#### POST `/api/organizations/{id}/users`
Add user to organization.

**Request:**
\`\`\`json
{
  "email": "newuser@example.com"
}
\`\`\`

---

## 💾 Database Schema

### user_profiles
Stores user account and wallet information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (matches auth.users.id) |
| email | TEXT | User email (unique) |
| available_balance | NUMERIC | Funds available for use |
| reserved_balance | NUMERIC | Funds reserved for pending transactions |
| organization_name | TEXT | Optional organization name |
| organization_id | TEXT | Optional organization ID |
| peppol_identifier | TEXT | User's Peppol ID |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

### wallet_transactions
Records all wallet transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to user_profiles |
| transaction_type | TEXT | Type: "top_up", "send_document", etc. |
| amount | NUMERIC | Transaction amount (positive or negative) |
| description | TEXT | Human-readable description |
| balance_before | NUMERIC | Balance before transaction |
| balance_after | NUMERIC | Balance after transaction |
| reference_id | UUID | Optional reference to pending_transactions |
| metadata | JSONB | Additional transaction data |
| created_at | TIMESTAMP | Transaction timestamp |

### pending_transactions
Tracks transactions in progress.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to user_profiles |
| amount | NUMERIC | Reserved amount |
| status | TEXT | Status: "pending", "completed", "failed" |
| transaction_type | TEXT | Type of transaction |
| ion_ap_transaction_id | TEXT | External transaction ID |
| metadata | JSONB | Additional data |
| reserved_at | TIMESTAMP | When funds were reserved |
| completed_at | TIMESTAMP | When transaction completed |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### pricing_config
Stores pricing information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| service_type | TEXT | Service: "send_document", etc. |
| price_per_transaction | NUMERIC | Price per transaction |
| currency | TEXT | Currency code (EUR, USD, etc.) |
| is_active | BOOLEAN | Whether pricing is active |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

---

## 👨‍💻 Development

### Project Structure

\`\`\`
demopostar/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── documents/      # Document management endpoints
│   │   ├── organizations/  # Organization endpoints
│   │   └── wallet/         # Wallet endpoints
│   ├── dashboard/          # Dashboard pages
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home/login page
├── components/
│   ├── ui/                 # Reusable UI components (shadcn)
│   ├── dashboard-layout.tsx
│   ├── login-form.tsx
│   ├── send-document-form.tsx
│   ├── user-profile-management.tsx
│   └── wallet-management.tsx
├── lib/
│   ├── supabase/           # Supabase client utilities
│   ├── app-context.tsx     # Global state context
│   ├── auth.ts             # Authentication utilities
│   ├── utils.ts            # Helper functions
│   └── wallet.ts           # Wallet service
├── public/
│   └── sample-invoices/    # Sample XML invoices
├── LICENSE.md              # EUPL v1.2 license
├── README.md               # This file
├── package.json
└── tsconfig.json
\`\`\`

### Development Workflow

1. **Create a feature branch:**
\`\`\`bash
git checkout -b feature/your-feature-name
\`\`\`

2. **Make your changes and test locally:**
\`\`\`bash
npm run dev
\`\`\`

3. **Run type checking:**
\`\`\`bash
npm run build
\`\`\`

4. **Commit your changes:**
\`\`\`bash
git add .
git commit -m "Add your feature description"
\`\`\`

5. **Push to GitHub:**
\`\`\`bash
git push origin feature/your-feature-name
\`\`\`

6. **Create a Pull Request** on GitHub

### Code Style

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Implement proper error handling
- Add comments for complex logic
- Use semantic HTML elements
- Ensure accessibility (ARIA labels, alt text)

---

## 🚀 Deployment

### Deploy to Vercel

#### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**
2. **Go to [vercel.com](https://vercel.com)**
3. **Click "Add New Project"**
4. **Import your GitHub repository**
5. **Configure environment variables** (from `.env.local`)
6. **Click "Deploy"**

Vercel will automatically:
- Build your Next.js app
- Set up continuous deployment
- Provide a production URL
- Configure SSL certificate

#### Option 2: Deploy with Vercel CLI

\`\`\`bash
npm install -g vercel
vercel login
vercel
\`\`\`

Follow the prompts to deploy.

### Environment Variables on Vercel

Add all environment variables from `.env.local` in the Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable with its value
4. Select environments (Production, Preview, Development)

### Post-Deployment

1. **Test the production URL**
2. **Verify Supabase connection**
3. **Test Stripe payments (if configured)**
4. **Check document sending/receiving**
5. **Monitor logs for errors**

---

## 📄 License

This project is licensed under the **European Union Public Licence (EUPL) v1.2**.

See [LICENSE.md](LICENSE.md) for the full license text.

### Key Points:

- ✅ Free to use, modify, and distribute
- ✅ Compatible with GPL, AGPL, MPL, and other open-source licenses
- ✅ Requires attribution to the original author
- ✅ Copyleft: Derivative works must use EUPL or compatible license
- ✅ No warranty provided

---

## 👤 Author

**Stanislav Pavlovic**

- GitHub: [@spavlovic77](https://github.com/spavlovic77)
- Repository: [demopostar](https://github.com/spavlovic77/demopostar)

---

## 🙏 Acknowledgments

- Built with [v0.app](https://v0.app) - AI-powered development
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Hosted on [Vercel](https://vercel.com)
- Database by [Supabase](https://supabase.com)
- Payments by [Stripe](https://stripe.com)
- Peppol integration via [ion-AP](https://test.ion-ap.net)

---

## 📞 Support

For issues, questions, or contributions:

1. **Check existing issues:** [GitHub Issues](https://github.com/spavlovic77/demopostar/issues)
2. **Create a new issue** if your problem isn't listed
3. **Submit a Pull Request** for contributions

---

**Last Updated:** January 2025  
**Version:** 1.2  
**License:** EUPL v1.2
