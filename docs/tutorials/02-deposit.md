# Tutorial 2: Deposit Assets

Learn how to deposit assets into a vault and receive shares.

## Overview

By the end of this tutorial you'll:
- Understand the deposit flow
- Make your first deposit
- See shares credited to your wallet

**Time:** ~5 minutes

---

## Prerequisites

- Canton Vault running ([Getting Started](../getting-started.md))
- Wallet connected ([Tutorial 1](./01-create-vault.md))
- Some test assets (or use mock mode)

---

## Step 1: Navigate to Vault Details

From the home page, click on a vault card:

```
┌─────────────────────────────────────────────────────────────┐
│  Canton USD Vault                    Share Price: 1         │
│  cUSDv                                                      │
│                                                             │
│  [Click anywhere on this card]                              │
└─────────────────────────────────────────────────────────────┘
```

You'll land on the vault detail page:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Vaults                                 alice::... │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Canton USD Vault                                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Total Assets │  │ Total Shares │  │ Share Price  │      │
│  │  1,000,000   │  │  1,000,000   │  │     1.00     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │      DEPOSIT        │  │       REDEEM        │          │
│  │                     │  │                     │          │
│  │  Amount             │  │  Shares             │          │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │          │
│  │  │               │  │  │  │               │  │          │
│  │  └───────────────┘  │  │  └───────────────┘  │          │
│  │                     │  │                     │          │
│  │  You'll receive:    │  │  You'll receive:    │          │
│  │  0 shares           │  │  0 assets           │          │
│  │                     │  │                     │          │
│  │  [ Deposit ]        │  │  [ Redeem ]         │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  Your Holdings                                              │
│  ├─ Shares: 0                                              │
│  └─ Value: $0                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 2: Enter Deposit Amount

In the **DEPOSIT** card:

1. Enter the amount of assets you want to deposit
2. Watch the preview update in real-time

```
┌─────────────────────┐
│      DEPOSIT        │
│                     │
│  Amount             │
│  ┌───────────────┐  │
│  │ 1000          │  │  ← Enter 1000
│  └───────────────┘  │
│                     │
│  You'll receive:    │
│  1000 shares        │  ← Preview updates
│                     │
│  [ Deposit ]        │
└─────────────────────┘
```

### Share Calculation

The preview shows how many shares you'll receive based on:

```
shares = assets × (totalShares / totalAssets)
```

For a 1:1 vault (share price = 1):
- Deposit 1000 assets → Receive 1000 shares

For a vault with yield (share price = 1.05):
- Deposit 1000 assets → Receive ~952.38 shares

---

## Step 3: Confirm Deposit

Click the **[Deposit]** button.

### With Wallet Connected

Your wallet will prompt for transaction approval:

```
┌─────────────────────────────────────────┐
│  Canton Wallet                          │
├─────────────────────────────────────────┤
│  Approve Transaction?                   │
│                                         │
│  Action: Vault_Deposit                  │
│  Vault: Canton USD Vault                │
│  Amount: 1,000.00 USDC                  │
│                                         │
│  [ Reject ]         [ Approve ]         │
└─────────────────────────────────────────┘
```

Click **Approve** to sign and submit.

### In Development Mode

The mock backend processes immediately:

```bash
# What happens behind the scenes:
POST /api/vaults/vault-1/deposit
{
  "party": "alice",
  "amount": "1000"
}

# Response:
{
  "shares": 1000,
  "txId": "mock-tx-123"
}
```

---

## Step 4: View Updated Holdings

After the deposit completes, the page updates:

```
┌─────────────────────────────────────────────────────────────┐
│  Canton USD Vault                                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Total Assets │  │ Total Shares │  │ Share Price  │      │
│  │  1,001,000 ↑ │  │  1,001,000 ↑ │  │     1.00     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ...                                                        │
│                                                             │
│  Your Holdings                                              │
│  ├─ Shares: 1,000 ✓                                        │
│  └─ Value: $1,000                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 5: Verify On-Chain (Optional)

You can verify the deposit via API:

```bash
# Check holdings
curl http://localhost:3000/api/vaults/vault-1/holdings/alice
{
  "shares": 1000,
  "value": 1000
}

# Check vault totals
curl http://localhost:3000/api/vaults/vault-1
{
  "id": "vault-1",
  "name": "Canton USD Vault",
  "totalAssets": 1001000,
  "totalShares": 1001000,
  "sharePrice": 1
}
```

---

## Understanding the Daml Flow

Behind the scenes, this Daml choice executes:

```daml
choice Vault_Deposit : (ContractId Vault, ContractId VaultShareHolding, Decimal)
  with
    depositor : Party
    assets : Decimal
  controller depositor
  do
    -- Calculate shares to mint
    let shares = if this.totalAssets == 0.0
                 then assets
                 else assets * (this.totalShares / this.totalAssets)
    
    -- Update vault
    newVault <- create this with
      totalAssets = this.totalAssets + assets
      totalShares = this.totalShares + shares
    
    -- Create share holding for depositor
    holding <- create VaultShareHolding with
      owner = depositor
      vault = this.operator
      instrument = this.config.shareInstrumentId
      amount = shares
      lock = None
    
    return (newVault, holding, shares)
```

---

## Troubleshooting

### "Insufficient balance"

You don't have enough underlying assets. In production, you'd need to:
1. Acquire the underlying token (e.g., USDC)
2. Ensure it's in your Canton wallet

### "Below minimum deposit"

The vault has a `minDeposit` requirement. Check the vault config:

```bash
curl http://localhost:3000/api/vaults/vault-1
# Look for minDeposit in response
```

### Transaction pending

For async vaults, deposits may require processing time. See [Tutorial 5: Async Operations](./05-async-operations.md).

---

## ✅ What You Learned

- How to navigate to vault details
- How to use the deposit form
- How share calculation works
- How to verify deposits via API

## Next Steps

→ [Tutorial 3: Redeem Shares](./03-redeem.md)
