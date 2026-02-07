# Architecture Overview

Canton Vault implements a complete tokenized vault system compliant with ERC-4626, EIP-7540, and CIP-0056.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Next.js 14 + Tailwind                       │   │
│  │  ┌───────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────┐  │   │
│  │  │ Vault List│  │Vault Detail│  │  Deposit/   │  │  Wallet  │  │   │
│  │  │   Page    │  │    Page    │  │   Redeem    │  │ Connect  │  │   │
│  │  └───────────┘  └────────────┘  └─────────────┘  └──────────┘  │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              CIP-0103 dApp API Wrapper                   │    │   │
│  │  │    (window.cantonDAppApi - injected by Canton wallet)    │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Node.js / Express / TypeScript                │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │   │
│  │  │   Vault API    │  │  Registry API  │  │  Ledger Client   │   │   │
│  │  │  /api/vaults/* │  │ /registry/v1/* │  │  (JSON API)      │   │   │
│  │  └────────────────┘  └────────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ JSON API (HTTP)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CANTON NETWORK                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Daml Smart Contracts                          │   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐   │   │
│  │  │    Vault     │  │ VaultShares   │  │   AsyncRequests     │   │   │
│  │  │  (ERC-4626)  │  │  (CIP-0056)   │  │     (EIP-7540)      │   │   │
│  │  └──────────────┘  └───────────────┘  └─────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │              TransferFactory (CIP-0056)                   │   │   │
│  │  │           FOP / DVP / Allocation Settlement               │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────┐  ┌────────────────┐                                │
│  │   Participant  │──│     Domain     │                                │
│  │   Node         │  │  (Synchronizer)│                                │
│  └────────────────┘  └────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (`/frontend`)

| File | Purpose |
|------|---------|
| `app/page.tsx` | Vault list homepage |
| `app/vault/[id]/page.tsx` | Vault detail with deposit/redeem |
| `components/WalletConnect.tsx` | CIP-0103 wallet button |
| `components/DepositForm.tsx` | Deposit UI with preview |
| `components/RedeemForm.tsx` | Redeem UI with preview |
| `lib/api.ts` | Backend API client |
| `lib/dapp-api.ts` | CIP-0103 wrapper |

### Backend (`/backend`)

| File | Purpose |
|------|---------|
| `src/server.ts` | Express server entry |
| `src/api/vault.ts` | Vault CRUD + deposit/redeem |
| `src/api/registry.ts` | CIP-0056 registry endpoints |
| `src/ledger/client.ts` | Canton JSON API client |
| `src/services/vault.ts` | Business logic |

### Daml Contracts (`/daml`)

| Module | Standard | Purpose |
|--------|----------|---------|
| `Vault.daml` | ERC-4626 | Core vault with deposit/withdraw/mint/redeem |
| `VaultShares.daml` | CIP-0056 | Share holdings with split/merge/transfer/lock |
| `AsyncRequests.daml` | EIP-7540 | Async deposit/redeem request patterns |
| `TransferFactory.daml` | CIP-0056 | FOP/DVP settlement |
| `Types.daml` | — | Shared types and IDs |

## Data Flow

### Deposit Flow

```
User                Frontend              Backend              Canton
 │                     │                     │                    │
 │  Enter amount       │                     │                    │
 │────────────────────>│                     │                    │
 │                     │  POST /deposit      │                    │
 │                     │────────────────────>│                    │
 │                     │                     │  Submit Daml cmd   │
 │                     │                     │───────────────────>│
 │                     │                     │                    │
 │                     │                     │  New VaultShares   │
 │                     │                     │<───────────────────│
 │                     │  { shares, tx }     │                    │
 │                     │<────────────────────│                    │
 │  Show confirmation  │                     │                    │
 │<────────────────────│                     │                    │
```

### CIP-0103 Wallet Flow

```
User                Frontend              Wallet Extension      Canton
 │                     │                     │                    │
 │  Click Connect      │                     │                    │
 │────────────────────>│                     │                    │
 │                     │  cantonDAppApi      │                    │
 │                     │  .connectWallet()   │                    │
 │                     │────────────────────>│                    │
 │                     │                     │  Prompt user       │
 │                     │                     │────────────────────│
 │                     │                     │<───────────────────│
 │                     │  { partyId }        │                    │
 │                     │<────────────────────│                    │
 │  Show party ID      │                     │                    │
 │<────────────────────│                     │                    │
```

## Standards Compliance

### ERC-4626 (Tokenized Vaults)

Implemented in `Vault.daml`:

```daml
-- Core interface
deposit(assets) → shares
withdraw(assets) → shares  
mint(shares) → assets
redeem(shares) → assets

-- Accounting
totalAssets()
totalSupply() → totalShares
convertToShares(assets)
convertToAssets(shares)
```

### EIP-7540 (Async Extensions)

Implemented in `AsyncRequests.daml`:

```daml
-- Async deposit
requestDeposit(assets) → DepositRequest
claimDeposit(request) → shares

-- Async redeem
requestRedeem(shares) → RedeemRequest
claimRedeem(request) → assets
```

### CIP-0056 (Canton Token Standard)

Implemented across multiple modules:

```daml
-- Holdings (VaultShares.daml)
VaultShareHolding with owner, instrument, amount, lock

-- Transfer Factory (TransferFactory.daml)
TransferFactory_Execute    -- FOP transfer
TransferFactory_Allocate   -- DVP allocation
TransferFactory_Settle     -- DVP settlement

-- Batch Operations
TransferFactory_BatchTransfer
TransferFactory_BatchAllocate
```

### CIP-0103 (dApp Standard)

Implemented in `lib/dapp-api.ts`:

```typescript
// Connect wallet
await cantonDAppApi.connectWallet()

// Sign transactions
await cantonDAppApi.signAndSubmit(command)

// Query party holdings
await cantonDAppApi.getHoldings(partyId, instrumentId)
```
