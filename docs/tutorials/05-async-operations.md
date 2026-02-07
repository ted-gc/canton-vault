# Tutorial 5: Async Operations (EIP-7540)

Learn how to use request-based deposits and redemptions for regulated or complex vault strategies.

## Overview

EIP-7540 extends ERC-4626 with async operations for:
- Real-world assets requiring settlement time
- Regulated vaults needing compliance checks
- Cross-chain vaults with bridging delays
- Large transactions requiring liquidity management

**Time:** ~15 minutes

---

## When to Use Async

| Vault Type | Sync or Async | Reason |
|------------|---------------|--------|
| Stablecoin yield | Sync | Instant liquidity |
| Treasury bills | Async | T+1 settlement |
| Real estate | Async | Valuation + compliance |
| Cross-chain | Async | Bridge confirmation |

---

## Async Deposit Flow

```
┌───────────────────────────────────────────────────────────────────────┐
│                        ASYNC DEPOSIT FLOW                              │
│                                                                        │
│   User              Vault             Operator           Settlement    │
│    │                  │                  │                   │        │
│    │ requestDeposit   │                  │                   │        │
│    │─────────────────>│                  │                   │        │
│    │                  │                  │                   │        │
│    │  DepositRequest  │                  │                   │        │
│    │<─────────────────│                  │                   │        │
│    │                  │                  │                   │        │
│    │                  │  Process request │                   │        │
│    │                  │─────────────────>│                   │        │
│    │                  │                  │                   │        │
│    │                  │                  │  Settle assets    │        │
│    │                  │                  │──────────────────>│        │
│    │                  │                  │                   │        │
│    │                  │  makeClaimable   │                   │        │
│    │                  │<─────────────────│                   │        │
│    │                  │                  │                   │        │
│    │ claimDeposit     │                  │                   │        │
│    │─────────────────>│                  │                   │        │
│    │                  │                  │                   │        │
│    │  VaultShares     │                  │                   │        │
│    │<─────────────────│                  │                   │        │
└───────────────────────────────────────────────────────────────────────┘
```

### Step 1: Request Deposit

```bash
curl -X POST http://localhost:3000/api/vaults/vault-1/request-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "party": "alice::1220abc123",
    "assets": "10000"
  }'

# Response
{
  "requestId": "deposit-req-001",
  "status": "pending",
  "assets": 10000,
  "estimatedShares": 10000,
  "estimatedCompletion": "2024-01-16T10:00:00Z"
}
```

### Step 2: Check Request Status

```bash
curl http://localhost:3000/api/vaults/vault-1/requests/deposit-req-001

{
  "requestId": "deposit-req-001",
  "status": "claimable",    # pending → processing → claimable
  "assets": 10000,
  "shares": 10000,          # Actual shares available
  "claimableAfter": "2024-01-16T10:00:00Z"
}
```

### Step 3: Claim Shares

Once status is `claimable`:

```bash
curl -X POST http://localhost:3000/api/vaults/vault-1/claim-deposit \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "deposit-req-001",
    "party": "alice::1220abc123"
  }'

# Response
{
  "shares": 10000,
  "holdingCid": "holding-alice-new-123",
  "txId": "tx-789"
}
```

---

## Async Redeem Flow

```
┌───────────────────────────────────────────────────────────────────────┐
│                        ASYNC REDEEM FLOW                               │
│                                                                        │
│   User              Vault             Operator           Settlement    │
│    │                  │                  │                   │        │
│    │ requestRedeem    │                  │                   │        │
│    │─────────────────>│                  │                   │        │
│    │                  │                  │                   │        │
│    │  RedeemRequest   │  (shares locked) │                   │        │
│    │<─────────────────│                  │                   │        │
│    │                  │                  │                   │        │
│    │                  │  Process request │                   │        │
│    │                  │─────────────────>│                   │        │
│    │                  │                  │                   │        │
│    │                  │                  │  Liquidate assets │        │
│    │                  │                  │──────────────────>│        │
│    │                  │                  │                   │        │
│    │                  │  makeClaimable   │                   │        │
│    │                  │<─────────────────│                   │        │
│    │                  │                  │                   │        │
│    │ claimRedeem      │                  │                   │        │
│    │─────────────────>│                  │                   │        │
│    │                  │                  │                   │        │
│    │  Assets          │  (shares burned) │                   │        │
│    │<─────────────────│                  │                   │        │
└───────────────────────────────────────────────────────────────────────┘
```

### Step 1: Request Redeem

```bash
curl -X POST http://localhost:3000/api/vaults/vault-1/request-redeem \
  -H "Content-Type: application/json" \
  -d '{
    "party": "alice::1220abc123",
    "shares": "5000",
    "holdingCid": "holding-alice-123"
  }'

# Response
{
  "requestId": "redeem-req-001",
  "status": "pending",
  "shares": 5000,
  "estimatedAssets": 5000,
  "estimatedCompletion": "2024-01-17T10:00:00Z"
}
```

Your shares are now locked:

```
Alice's Holdings:
├─ Shares: 5000 [LOCKED for redeem-req-001]
└─ Available: 5000
```

### Step 2: Wait for Processing

The vault operator processes the request:

```bash
# Check status
curl http://localhost:3000/api/vaults/vault-1/requests/redeem-req-001

{
  "requestId": "redeem-req-001",
  "status": "processing",     # Operator is liquidating
  "shares": 5000,
  "estimatedAssets": 5000
}
```

### Step 3: Claim Assets

Once claimable:

```bash
curl -X POST http://localhost:3000/api/vaults/vault-1/claim-redeem \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "redeem-req-001",
    "party": "alice::1220abc123"
  }'

# Response
{
  "assets": 5000,
  "txId": "tx-redeem-456"
}
```

---

## Request States

```
┌─────────┐     ┌────────────┐     ┌───────────┐     ┌─────────┐
│ pending │────>│ processing │────>│ claimable │────>│ claimed │
└─────────┘     └────────────┘     └───────────┘     └─────────┘
     │                                                     
     │          ┌───────────┐                              
     └─────────>│ cancelled │                              
                └───────────┘                              
```

| State | Description | User Action |
|-------|-------------|-------------|
| `pending` | Request submitted | Wait |
| `processing` | Operator working | Wait |
| `claimable` | Ready to claim | Call claim |
| `claimed` | Completed | None |
| `cancelled` | Request cancelled | Funds returned |

---

## Cancel Request

Before `claimable` state, you can cancel:

```bash
curl -X POST http://localhost:3000/api/vaults/vault-1/cancel-request \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "redeem-req-001",
    "party": "alice::1220abc123"
  }'

# Response
{
  "status": "cancelled",
  "sharesUnlocked": 5000
}
```

---

## Daml Implementation

### Async Deposit Request

```daml
template DepositRequest
  with
    vault : Party
    depositor : Party
    assets : Decimal
    requestTime : Time
    status : RequestStatus
    claimableShares : Optional Decimal
  where
    signatory vault, depositor
    
    choice DepositRequest_MakeClaimable : ContractId DepositRequest
      with
        shares : Decimal
      controller vault
      do
        create this with 
          status = Claimable
          claimableShares = Some shares
    
    choice DepositRequest_Claim : ContractId VaultShareHolding
      controller depositor
      do
        assertMsg "Not claimable" (this.status == Claimable)
        let shares = fromSome this.claimableShares
        create VaultShareHolding with
          owner = depositor
          vault = this.vault
          amount = shares
          lock = None
```

### Async Redeem Request

```daml
template RedeemRequest
  with
    vault : Party
    redeemer : Party
    shares : Decimal
    lockedHoldingCid : ContractId VaultShareHolding
    requestTime : Time
    status : RequestStatus
    claimableAssets : Optional Decimal
  where
    signatory vault, redeemer
    
    choice RedeemRequest_MakeClaimable : ContractId RedeemRequest
      with
        assets : Decimal
      controller vault
      do
        create this with 
          status = Claimable
          claimableAssets = Some assets
    
    choice RedeemRequest_Claim : Decimal
      controller redeemer
      do
        assertMsg "Not claimable" (this.status == Claimable)
        archive this.lockedHoldingCid  -- Burn shares
        return (fromSome this.claimableAssets)
```

---

## UI Indicators

The frontend shows async status:

```
┌─────────────────────────────────────────────────────────────┐
│  Your Pending Requests                                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  📥 Deposit Request #001                              │ │
│  │  Status: ⏳ Processing                                │ │
│  │  Amount: 10,000 USDC → ~10,000 shares                │ │
│  │  ETA: Jan 16, 10:00 AM                               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  📤 Redeem Request #001                               │ │
│  │  Status: ✅ Claimable                                 │ │
│  │  Amount: 5,000 shares → 5,000 USDC                   │ │
│  │  [ Claim Now ]                                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Request stuck in "pending"

The vault operator may be offline or the queue is full. Contact vault support.

### "Not claimable"

The request hasn't been processed yet. Check estimated completion time.

### "Request expired"

Some vaults have request expiry. Submit a new request.

### Shares still locked after cancel

Allow a few blocks for the cancellation to process.

---

## ✅ What You Learned

- Why async operations exist (RWA, compliance, etc.)
- How to request async deposits
- How to request async redemptions
- Request lifecycle and states
- How to cancel pending requests

## Next Steps

- [API Reference](../api-reference.md) - Full endpoint documentation
- [Deployment Guide](../deployment.md) - Deploy to TestNet/MainNet
