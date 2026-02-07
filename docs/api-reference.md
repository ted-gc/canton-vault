# API Reference

Complete REST API documentation for Canton Vault backend.

## Base URL

```
Development: http://localhost:3000
Production:  https://api.your-vault.com
```

## Authentication

For production, include JWT token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/vaults
```

Development mode accepts unauthenticated requests.

---

## Health Check

### GET /health

Check if the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Vaults

### GET /api/vaults

List all vaults.

**Response:**
```json
[
  {
    "id": "vault-1",
    "name": "Canton USD Vault",
    "symbol": "cUSDv",
    "totalAssets": 1000000,
    "totalShares": 1000000,
    "sharePrice": 1.0
  }
]
```

### GET /api/vaults/:id

Get vault details.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | path | Vault identifier |

**Response:**
```json
{
  "id": "vault-1",
  "name": "Canton USD Vault",
  "symbol": "cUSDv",
  "description": "Yield-bearing USDC vault",
  "totalAssets": 1000000,
  "totalShares": 1000000,
  "sharePrice": 1.0,
  "config": {
    "underlyingAsset": "USDC::canton",
    "depositLimit": 10000000,
    "minDeposit": 10,
    "withdrawalDelay": null,
    "managementFeeBps": 25,
    "performanceFeeBps": 500
  }
}
```

---

## Deposits

### POST /api/vaults/:id/deposit

Deposit assets and receive shares.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | path | Vault identifier |

**Body:**
```json
{
  "party": "alice::1220abc123...",
  "amount": "1000"
}
```

**Response:**
```json
{
  "shares": 1000,
  "sharePrice": 1.0,
  "txId": "tx-123"
}
```

**Errors:**
| Code | Description |
|------|-------------|
| 400 | Invalid amount |
| 400 | Below minimum deposit |
| 400 | Exceeds deposit limit |
| 403 | Party not authorized |

### POST /api/vaults/:id/request-deposit

Request async deposit (EIP-7540).

**Body:**
```json
{
  "party": "alice::1220abc123...",
  "assets": "10000"
}
```

**Response:**
```json
{
  "requestId": "deposit-req-001",
  "status": "pending",
  "assets": 10000,
  "estimatedShares": 10000,
  "estimatedCompletion": "2024-01-16T10:00:00Z"
}
```

### POST /api/vaults/:id/claim-deposit

Claim shares from async deposit.

**Body:**
```json
{
  "requestId": "deposit-req-001",
  "party": "alice::1220abc123..."
}
```

**Response:**
```json
{
  "shares": 10000,
  "holdingCid": "holding-123",
  "txId": "tx-456"
}
```

---

## Redemptions

### POST /api/vaults/:id/redeem

Redeem shares for assets.

**Body:**
```json
{
  "party": "alice::1220abc123...",
  "shares": "500"
}
```

**Response:**
```json
{
  "assets": 500,
  "sharePrice": 1.0,
  "txId": "tx-789"
}
```

**Errors:**
| Code | Description |
|------|-------------|
| 400 | Invalid shares amount |
| 400 | Insufficient shares |
| 400 | Shares locked |

### POST /api/vaults/:id/request-redeem

Request async redemption (EIP-7540).

**Body:**
```json
{
  "party": "alice::1220abc123...",
  "shares": "5000",
  "holdingCid": "holding-alice-123"
}
```

**Response:**
```json
{
  "requestId": "redeem-req-001",
  "status": "pending",
  "shares": 5000,
  "estimatedAssets": 5000,
  "estimatedCompletion": "2024-01-17T10:00:00Z"
}
```

### POST /api/vaults/:id/claim-redeem

Claim assets from async redemption.

**Body:**
```json
{
  "requestId": "redeem-req-001",
  "party": "alice::1220abc123..."
}
```

**Response:**
```json
{
  "assets": 5000,
  "txId": "tx-redeem-456"
}
```

---

## Holdings

### GET /api/vaults/:id/holdings/:party

Get party's share holdings.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | path | Vault identifier |
| `party` | path | Canton party ID |

**Response:**
```json
{
  "shares": 1000,
  "value": 1000,
  "lock": null
}
```

With lock:
```json
{
  "shares": 1000,
  "value": 1000,
  "lock": {
    "type": "allocation",
    "settlementId": "settle-789",
    "expiresAt": "2024-01-20T10:00:00Z"
  }
}
```

---

## Requests (Async)

### GET /api/vaults/:id/requests/:requestId

Get async request status.

**Response:**
```json
{
  "requestId": "deposit-req-001",
  "type": "deposit",
  "status": "claimable",
  "assets": 10000,
  "shares": 10000,
  "requestTime": "2024-01-15T10:00:00Z",
  "claimableAfter": "2024-01-16T10:00:00Z"
}
```

### POST /api/vaults/:id/cancel-request

Cancel pending request.

**Body:**
```json
{
  "requestId": "redeem-req-001",
  "party": "alice::1220abc123..."
}
```

**Response:**
```json
{
  "status": "cancelled",
  "sharesUnlocked": 5000
}
```

---

## CIP-0056 Registry

### GET /registry/v1/metadata

Get registry metadata.

**Response:**
```json
{
  "name": "Canton Vault Registry",
  "version": "1.0.0",
  "supportedInstruments": ["vault-shares"],
  "capabilities": ["fop", "dvp", "batch"]
}
```

### POST /registry/transfer-instruction-v1/transfer-factory

Create transfer instruction.

**Body (FOP):**
```json
{
  "mode": "fop",
  "sender": "alice::1220abc123...",
  "receiver": "bob::1220def456...",
  "instrument": "vault-1-shares",
  "amount": "100"
}
```

**Body (DVP):**
```json
{
  "mode": "dvp",
  "deliveryLeg": {
    "sender": "alice::1220abc123...",
    "receiver": "bob::1220def456...",
    "instrument": "vault-1-shares",
    "amount": "100"
  },
  "paymentLeg": {
    "sender": "bob::1220def456...",
    "receiver": "alice::1220abc123...",
    "instrument": "USDC::canton",
    "amount": "1000"
  }
}
```

**Response:**
```json
{
  "transferId": "transfer-001",
  "status": "pending"
}
```

### POST /registry/allocate

Allocate holdings for settlement.

**Body:**
```json
{
  "settlementId": "settle-789",
  "party": "alice::1220abc123...",
  "leg": "delivery",
  "holdingCid": "holding-alice-123"
}
```

### POST /registry/settle

Execute settlement.

**Body:**
```json
{
  "settlementId": "settle-789"
}
```

### POST /registry/batch-transfer

Batch transfer to multiple recipients.

**Body:**
```json
{
  "sender": "alice::1220abc123...",
  "instrument": "vault-1-shares",
  "transfers": [
    {"receiver": "bob::1220def456...", "amount": "50"},
    {"receiver": "carol::1220ghi789...", "amount": "30"}
  ]
}
```

---

## Conversion Helpers

### GET /api/vaults/:id/convert-to-shares?assets=1000

Preview assets → shares conversion.

**Response:**
```json
{
  "assets": 1000,
  "shares": 952.38,
  "sharePrice": 1.05
}
```

### GET /api/vaults/:id/convert-to-assets?shares=1000

Preview shares → assets conversion.

**Response:**
```json
{
  "shares": 1000,
  "assets": 1050,
  "sharePrice": 1.05
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "INSUFFICIENT_SHARES",
    "message": "Not enough shares to redeem",
    "details": {
      "requested": 1000,
      "available": 500
    }
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_AMOUNT` | 400 | Amount is invalid or negative |
| `BELOW_MINIMUM` | 400 | Below minimum deposit/redeem |
| `EXCEEDS_LIMIT` | 400 | Exceeds vault deposit limit |
| `INSUFFICIENT_SHARES` | 400 | Not enough shares |
| `SHARES_LOCKED` | 400 | Shares are locked |
| `NOT_CLAIMABLE` | 400 | Request not ready to claim |
| `REQUEST_NOT_FOUND` | 404 | Request ID not found |
| `VAULT_NOT_FOUND` | 404 | Vault ID not found |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | Party not authorized |
| `LEDGER_ERROR` | 500 | Canton ledger error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| GET requests | 100/min |
| POST requests | 20/min |
| Batch operations | 5/min |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705401600
```
