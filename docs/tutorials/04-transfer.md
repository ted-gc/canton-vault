# Tutorial 4: Transfer Shares

Learn how to transfer vault shares between parties using CIP-0056 patterns.

## Overview

By the end of this tutorial you'll understand:
- FOP (Free-of-Payment) transfers
- DVP (Delivery-vs-Payment) settlement
- Batch transfer operations

**Time:** ~10 minutes

---

## Transfer Types

CIP-0056 defines three settlement modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **FOP** | Free transfer, no payment | Gifts, internal moves |
| **DVP** | Atomic swap with payment | Trading, purchases |
| **Allocation** | Pre-stage for DVP | Complex settlements |

---

## FOP Transfer (Simple)

Transfer shares directly to another party.

### Step 1: Identify Recipient

You'll need the recipient's Canton party ID:

```
alice::1220abc123...    (sender - you)
bob::1220def456...      (recipient)
```

### Step 2: Initiate Transfer

Via API:

```bash
curl -X POST http://localhost:3000/registry/transfer-instruction-v1/transfer-factory \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "alice::1220abc123",
    "receiver": "bob::1220def456",
    "instrument": "vault-1-shares",
    "amount": "100",
    "mode": "fop"
  }'
```

### Step 3: Recipient Receives Shares

Bob's holdings update:

```
Bob's Holdings:
├─ Shares: 100 (new)
└─ Value: $100
```

### Daml Flow

```daml
choice TransferFactory_Execute : ContractId VaultShareHolding
  with
    sender : Party
    receiver : Party
    amount : Decimal
    holdingCid : ContractId VaultShareHolding
  controller sender
  do
    -- Fetch sender's holding
    holding <- fetch holdingCid
    assertMsg "Not owner" (holding.owner == sender)
    assertMsg "Insufficient" (holding.amount >= amount)
    
    -- Split holding if partial transfer
    if holding.amount == amount
      then do
        archive holdingCid
        create holding with owner = receiver
      else do
        create holding with amount = holding.amount - amount
        create holding with owner = receiver, amount = amount
```

---

## DVP Settlement (Atomic Swap)

Trade shares for payment atomically.

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DVP Settlement                            │
│                                                              │
│  Alice                                          Bob          │
│  ┌─────────┐                              ┌─────────┐       │
│  │ 100     │──── shares ────────────────>│ 100     │       │
│  │ shares  │                              │ shares  │       │
│  └─────────┘                              └─────────┘       │
│                                                              │
│  ┌─────────┐                              ┌─────────┐       │
│  │ 1000    │<──── payment ───────────────│ 1000    │       │
│  │ USDC    │                              │ USDC    │       │
│  └─────────┘                              └─────────┘       │
│                                                              │
│  Both legs settle atomically or neither does                │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Create Settlement Instruction

```bash
curl -X POST http://localhost:3000/registry/transfer-instruction-v1/transfer-factory \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "dvp",
    "deliveryLeg": {
      "sender": "alice::1220abc123",
      "receiver": "bob::1220def456",
      "instrument": "vault-1-shares",
      "amount": "100"
    },
    "paymentLeg": {
      "sender": "bob::1220def456",
      "receiver": "alice::1220abc123",
      "instrument": "USDC::canton",
      "amount": "1000"
    }
  }'

# Response
{
  "settlementId": "settle-789",
  "status": "pending",
  "deliveryAllocated": false,
  "paymentAllocated": false
}
```

### Step 2: Alice Allocates Shares

Alice locks her shares for the settlement:

```bash
curl -X POST http://localhost:3000/registry/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "settlementId": "settle-789",
    "party": "alice::1220abc123",
    "leg": "delivery",
    "holdingCid": "holding-alice-123"
  }'
```

Holdings now show:

```
Alice's Holdings:
├─ Shares: 100 [LOCKED for settle-789]
└─ Value: $100
```

### Step 3: Bob Allocates Payment

Bob locks his USDC:

```bash
curl -X POST http://localhost:3000/registry/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "settlementId": "settle-789",
    "party": "bob::1220def456",
    "leg": "payment",
    "holdingCid": "holding-bob-usdc-456"
  }'
```

### Step 4: Execute Settlement

Once both legs are allocated, either party can trigger settlement:

```bash
curl -X POST http://localhost:3000/registry/settle \
  -H "Content-Type: application/json" \
  -d '{
    "settlementId": "settle-789"
  }'

# Response
{
  "status": "settled",
  "deliveryTx": "tx-delivery-123",
  "paymentTx": "tx-payment-456"
}
```

### Final State

```
Alice:                          Bob:
├─ Shares: 0                   ├─ Shares: 100 ✓
├─ USDC: +1000 ✓               └─ USDC: -1000
```

---

## Batch Transfers

Transfer to multiple recipients in one transaction.

```bash
curl -X POST http://localhost:3000/registry/batch-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "alice::1220abc123",
    "transfers": [
      {"receiver": "bob::1220def456", "amount": "50"},
      {"receiver": "carol::1220ghi789", "amount": "30"},
      {"receiver": "dave::1220jkl012", "amount": "20"}
    ],
    "instrument": "vault-1-shares"
  }'
```

All 3 transfers execute atomically.

---

## Lock States

Shares can be in different lock states:

| State | Can Transfer | Can Redeem | Description |
|-------|--------------|------------|-------------|
| `None` | ✓ | ✓ | Fully liquid |
| `Allocation` | ✗ | ✗ | Locked for DVP |
| `TimeLock` | ✗ | ✗ | Locked until timestamp |
| `Regulatory` | ✗ | ✗ | Compliance hold |

### Check Lock Status

```bash
curl http://localhost:3000/api/vaults/vault-1/holdings/alice
{
  "shares": 100,
  "value": 100,
  "lock": {
    "type": "allocation",
    "settlementId": "settle-789"
  }
}
```

### Unlock (Cancel Allocation)

If settlement is cancelled:

```bash
curl -X POST http://localhost:3000/registry/deallocate \
  -H "Content-Type: application/json" \
  -d '{
    "settlementId": "settle-789",
    "party": "alice::1220abc123"
  }'
```

---

## Troubleshooting

### "Shares locked"

Check if shares are allocated for pending settlement:

```bash
curl http://localhost:3000/api/vaults/vault-1/holdings/alice
```

Cancel the settlement to unlock, or wait for completion.

### "Settlement expired"

DVP settlements have a deadline. If not completed in time, allocations are automatically released.

### "Counterparty not allocated"

Both parties must allocate before settlement can execute. Contact the counterparty.

---

## ✅ What You Learned

- FOP transfers for simple share movement
- DVP settlement for atomic swaps
- Allocation and lock mechanics
- Batch transfer operations

## Next Steps

→ [Tutorial 5: Async Operations](./05-async-operations.md)
