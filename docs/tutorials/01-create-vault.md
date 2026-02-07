# Tutorial 1: Create Your First Vault

This tutorial walks through creating and configuring a tokenized vault.

## Overview

By the end of this tutorial you'll have:
- A running vault contract on Canton
- Understanding of vault parameters
- A connected wallet ready for deposits

**Time:** ~10 minutes

---

## Step 1: Start the Application

First, ensure both backend and frontend are running:

```bash
# Terminal 1 - Backend
cd canton-vault/backend
npm run dev

# Terminal 2 - Frontend  
cd canton-vault/frontend
PORT=3001 npm run dev
```

### ✓ Checkpoint

Open http://localhost:3001 in your browser. You should see the vault list:

```
┌─────────────────────────────────────────────────────────────┐
│  Canton Vault                              [Connect Wallet] │
│  Secure yield vaults on Canton                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Canton USD Vault                    Share Price: 1 │   │
│  │                                                     │   │
│  │  Total Assets    Total Shares    APY               │   │
│  │  1,000,000       1,000,000       —                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

> **Note:** The demo starts with a pre-configured vault. We'll create a custom one next.

---

## Step 2: Connect Your Wallet

Click the **[Connect Wallet]** button in the top right.

### With Canton Wallet Extension

If you have a CIP-0103 compatible wallet installed:

1. Click **Connect Wallet**
2. Approve the connection in your wallet popup
3. Your party ID appears in the header

```
┌─────────────────────────────────────────────────────────────┐
│  Canton Vault                    alice::122034ab...  [···]  │
└─────────────────────────────────────────────────────────────┘
```

### Without a Wallet (Development Mode)

For testing, you can use a mock party ID via the API:

```bash
# Use any party ID for testing
curl http://localhost:3000/api/vaults/vault-1/holdings/alice
# Returns: {"shares":0,"value":0}
```

---

## Step 3: Understanding Vault Parameters

Each vault has configuration parameters defined in Daml:

```daml
data VaultConfig = VaultConfig with
    underlyingAsset : InstrumentId    -- What the vault holds (e.g., USDC)
    shareInstrumentId : Text          -- Share token symbol (e.g., cUSDv)
    depositLimit : Optional Decimal   -- Max total deposits (None = unlimited)
    minDeposit : Decimal              -- Minimum deposit amount
    withdrawalDelay : Optional Int    -- Async delay in microseconds
    managementFeeBps : Int            -- Annual management fee (basis points)
    performanceFeeBps : Int           -- Performance fee (basis points)
```

### Parameter Reference

| Parameter | Description | Example |
|-----------|-------------|---------|
| `underlyingAsset` | Token the vault accepts | `USDC::canton` |
| `shareInstrumentId` | Symbol for vault shares | `cUSDv` |
| `depositLimit` | Maximum deposits | `Some 10_000_000.0` |
| `minDeposit` | Minimum per deposit | `100.0` |
| `withdrawalDelay` | Async withdrawal delay | `Some 86400_000_000` (1 day) |
| `managementFeeBps` | Annual fee in bps | `50` (0.5%) |
| `performanceFeeBps` | Performance fee in bps | `1000` (10%) |

---

## Step 4: Create a Vault via Daml

To create a new vault, you'll submit a Daml command. Here's the template:

```daml
-- In a Daml script or via JSON API
createVault = do
  let config = VaultConfig with
        underlyingAsset = InstrumentId "USDC" "canton-usdc-issuer"
        shareInstrumentId = "vUSDC"
        depositLimit = Some 1_000_000.0
        minDeposit = 10.0
        withdrawalDelay = None  -- Synchronous
        managementFeeBps = 25   -- 0.25% annual
        performanceFeeBps = 500 -- 5% of profits
  
  vault <- submit vaultOperator do
    createCmd Vault with
      operator = vaultOperator
      config
      totalAssets = 0.0
      totalShares = 0.0
      lastAccrualTime = getCurrentTime
  
  return vault
```

### Via REST API (Simplified)

```bash
curl -X POST http://localhost:3000/api/vaults \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Vault",
    "symbol": "MYV",
    "underlyingAsset": "USDC",
    "depositLimit": 1000000,
    "minDeposit": 10
  }'
```

> **Note:** The current demo backend uses mock data. Full Daml integration requires a Canton node.

---

## Step 5: View Your Vault

After creation, your vault appears in the list:

```
┌─────────────────────────────────────────────────────────────┐
│  Canton Vault                              [Connected ✓]    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Canton USD Vault                    Share Price: 1 │   │
│  │  ...                                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  My Custom Vault ← NEW                Share Price: 1│   │
│  │  MYV                                                │   │
│  │                                                     │   │
│  │  Total Assets    Total Shares    APY               │   │
│  │  0               0               —                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Click on your vault to access the detail page.

---

## ✅ What You Learned

- How to start Canton Vault locally
- How to connect a Canton wallet (CIP-0103)
- Vault configuration parameters
- Creating a vault via Daml or API

## Next Steps

→ [Tutorial 2: Deposit Assets](./02-deposit.md)
