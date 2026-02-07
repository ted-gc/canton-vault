# Tutorial 3: Redeem Shares

Learn how to convert your vault shares back to underlying assets.

## Overview

By the end of this tutorial you'll:
- Understand the redeem flow
- Redeem shares for assets
- Know the difference between redeem and withdraw

**Time:** ~5 minutes

---

## Prerequisites

- Canton Vault running
- Some shares in your wallet (complete [Tutorial 2](./02-deposit.md) first)

---

## Step 1: Check Your Holdings

On the vault detail page, find the "Your Holdings" section:

```
┌─────────────────────────────────────────────────────────────┐
│  Your Holdings                                              │
│  ├─ Shares: 1,000                                          │
│  └─ Value: $1,000                                          │
└─────────────────────────────────────────────────────────────┘
```

You can only redeem shares you own.

---

## Step 2: Enter Shares to Redeem

In the **REDEEM** card:

1. Enter the number of shares to redeem
2. Watch the asset preview update

```
┌─────────────────────┐
│       REDEEM        │
│                     │
│  Shares             │
│  ┌───────────────┐  │
│  │ 500           │  │  ← Enter 500
│  └───────────────┘  │
│                     │
│  You'll receive:    │
│  500 assets         │  ← Preview
│                     │
│  [ Redeem ]         │
└─────────────────────┘
```

### Asset Calculation

The preview shows assets you'll receive:

```
assets = shares × (totalAssets / totalShares)
```

With yield accrual (share price = 1.05):
- Redeem 500 shares → Receive 525 assets

---

## Step 3: Confirm Redemption

Click **[Redeem]** to initiate.

### Wallet Approval

```
┌─────────────────────────────────────────┐
│  Canton Wallet                          │
├─────────────────────────────────────────┤
│  Approve Transaction?                   │
│                                         │
│  Action: Vault_Redeem                   │
│  Vault: Canton USD Vault                │
│  Shares: 500.00 cUSDv                   │
│  Receive: ~500.00 USDC                  │
│                                         │
│  [ Reject ]         [ Approve ]         │
└─────────────────────────────────────────┘
```

---

## Step 4: View Updated Holdings

After redemption:

```
┌─────────────────────────────────────────────────────────────┐
│  Canton USD Vault                                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Total Assets │  │ Total Shares │  │ Share Price  │      │
│  │  1,000,500 ↓ │  │  1,000,500 ↓ │  │     1.00     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ...                                                        │
│                                                             │
│  Your Holdings                                              │
│  ├─ Shares: 500 ↓                                          │
│  └─ Value: $500                                            │
└─────────────────────────────────────────────────────────────┘
```

The 500 assets are now in your wallet.

---

## Redeem vs Withdraw

ERC-4626 defines two ways to exit:

| Operation | Input | Output | Use Case |
|-----------|-------|--------|----------|
| **Redeem** | Shares | Assets | "I want to sell 500 shares" |
| **Withdraw** | Assets | Shares | "I need exactly 1000 USDC" |

### Redeem (shares → assets)

```
redeem(500 shares) → ? assets
```
You specify shares, receive calculated assets.

### Withdraw (assets → shares)

```
withdraw(1000 assets) → ? shares burned
```
You specify assets needed, system burns required shares.

The UI defaults to **Redeem** for simplicity.

---

## Full vs Partial Redemption

### Partial Redemption

Redeem some shares, keep the rest:

```
Holdings: 1000 shares
Redeem: 500 shares
Result: 500 shares remaining
```

### Full Redemption

Enter your entire balance to exit completely:

```
Holdings: 500 shares
Redeem: 500 shares (MAX)
Result: 0 shares, position closed
```

> **Tip:** Use the "MAX" button (if available) to redeem all shares.

---

## API Reference

```bash
# Redeem shares
curl -X POST http://localhost:3000/api/vaults/vault-1/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "party": "alice",
    "shares": "500"
  }'

# Response
{
  "assets": 500,
  "txId": "tx-456"
}
```

---

## The Daml Flow

```daml
choice Vault_Redeem : (ContractId Vault, Decimal)
  with
    redeemer : Party
    shares : Decimal
    holdingCid : ContractId VaultShareHolding
  controller redeemer
  do
    -- Fetch and verify holding
    holding <- fetch holdingCid
    assertMsg "Not owner" (holding.owner == redeemer)
    assertMsg "Insufficient shares" (holding.amount >= shares)
    
    -- Calculate assets to return
    let assets = shares * (this.totalAssets / this.totalShares)
    
    -- Update vault
    newVault <- create this with
      totalAssets = this.totalAssets - assets
      totalShares = this.totalShares - shares
    
    -- Update or archive holding
    if holding.amount == shares
      then archive holdingCid
      else do
        create holding with amount = holding.amount - shares
        return ()
    
    return (newVault, assets)
```

---

## Troubleshooting

### "Insufficient shares"

You're trying to redeem more than you own. Check holdings:

```bash
curl http://localhost:3000/api/vaults/vault-1/holdings/alice
```

### "Shares locked"

Your shares may be locked for DVP settlement or other reasons. You must unlock them first or wait for the lock to expire.

### Redemption delayed

For async vaults (EIP-7540), redemptions may require:
1. Request → Wait for processing → Claim

See [Tutorial 5: Async Operations](./05-async-operations.md).

---

## ✅ What You Learned

- How to redeem shares for assets
- Difference between redeem and withdraw
- Partial vs full redemption
- API and Daml flow

## Next Steps

→ [Tutorial 4: Transfer Shares](./04-transfer.md)
