# Getting Started

This guide walks you through setting up Canton Vault locally.

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 22+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | Latest | `docker --version` |
| Daml SDK | 3.3.x | `daml version` (optional) |

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ted-gc/canton-vault.git
cd canton-vault
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Start Development Servers

**Terminal 1 - Backend (port 3000):**
```bash
cd backend
npm run dev
```

You should see:
```
Canton Vault backend listening on :3000
```

**Terminal 2 - Frontend (port 3001):**
```bash
cd frontend
PORT=3001 npm run dev
```

You should see:
```
▲ Next.js 14.x
- Local: http://localhost:3001
```

### 4. Open the App

Navigate to **http://localhost:3001** in your browser.

---

## What You'll See

### Home Page - Vault List

```
┌─────────────────────────────────────────────────────────────┐
│  Canton Vault                              [Connect Wallet] │
│  Secure yield vaults on Canton                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Canton USD Vault                    Share Price: 1 │   │
│  │  cUSDv                                              │   │
│  │                                                     │   │
│  │  Total Assets    Total Shares    APY               │   │
│  │  1,000,000       1,000,000       —                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Click on a vault card to view details and interact.

### Vault Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Vaults                        [Connect Wallet]   │
├─────────────────────────────────────────────────────────────┤
│  Canton USD Vault                                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Total Assets │  │ Total Shares │  │ Share Price  │      │
│  │  1,000,000   │  │  1,000,000   │  │     1.00     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │      DEPOSIT        │  │       REDEEM        │          │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │          │
│  │  │ Amount: _____ │  │  │  │ Shares: _____ │  │          │
│  │  └───────────────┘  │  │  └───────────────┘  │          │
│  │  Preview: 0 shares  │  │  Preview: 0 assets  │          │
│  │  [    Deposit    ]  │  │  [     Redeem    ]  │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  Your Holdings                                              │
│  ├─ Shares: 0                                              │
│  └─ Value: $0                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. [Connect your wallet](./tutorials/01-create-vault.md#connecting-a-wallet)
2. [Make your first deposit](./tutorials/02-deposit.md)
3. [Explore the API](./api-reference.md)

## Troubleshooting

### "Failed to load vaults" error

Ensure the backend is running on port 3000:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### Port already in use

Kill existing processes:
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Module not found errors

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```
