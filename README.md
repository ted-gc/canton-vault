# Canton Vault 🏦

A fully CIP-0056 compliant implementation of ERC-4626 tokenized vaults with EIP-7540 async extensions for Canton Network.

## Overview

Canton Vault enables yield-bearing vault strategies on Canton Network with:
- **ERC-4626 compatible** deposit/withdraw/mint/redeem operations
- **EIP-7540 async flows** for RWA, cross-chain, or regulated assets
- **CIP-0056 token standard** - shares work in any Canton wallet
- **CIP-0103 dApp integration** - standard wallet connection

## Quick Start

### Prerequisites

- Docker Desktop (8GB+ RAM recommended)
- Node.js 22+
- Daml SDK 3.3.x (optional, for Daml development)

### LocalNet (Recommended)

The fastest way to run the full stack with a local Canton network:

```bash
cd localnet
./scripts/init-network.sh
```

This starts:
- **Canton Domain & Participant** - Local Canton Network
- **JSON API** - HTTP Ledger API (port 6201)
- **Backend** - REST API (port 3000)
- **Frontend** - Next.js UI (port 3001)

Access the app at: **http://localhost:3001**

#### LocalNet Commands

```bash
cd localnet
./scripts/init-network.sh   # Start everything
./scripts/stop.sh           # Stop network
./scripts/clean.sh          # Remove data & volumes
docker compose logs -f      # Follow logs
```

### Manual Development Setup

If you prefer to run services individually:

#### 1. Install Daml SDK

```bash
curl -sSL https://get.daml.com/ | sh -s 3.3.0-snapshot.20250603.0
```

#### 2. Build Daml

```bash
daml build
```

#### 3. Run Backend

```bash
cd backend
npm install
npm run dev
```

#### 4. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
canton-vault/
├── daml/                      # Daml smart contracts
│   ├── Splice/Vault/
│   │   ├── Types.daml         # Core types
│   │   ├── Vault.daml         # Main vault template
│   │   ├── VaultShares.daml   # Share holdings (CIP-0056)
│   │   ├── AsyncRequests.daml # EIP-7540 async patterns
│   │   └── TransferFactory.daml # CIP-0056 transfer/allocation
│   └── Test/
│       └── VaultTest.daml     # Test scripts
├── backend/                   # Node.js REST API
│   └── src/
│       ├── server.ts          # Express server
│       ├── api/               # Route handlers
│       ├── ledger/            # Canton API client
│       └── services/          # Business logic
├── frontend/                  # Next.js UI
│   └── app/
│       ├── page.tsx           # Vault list
│       └── vault/[id]/        # Vault details
├── PLAN.md                    # Project plan
├── DESIGN.md                  # Technical design
└── README.md                  # This file
```

## Standards Compliance

| Standard | Description | Implementation |
|----------|-------------|----------------|
| **ERC-4626** | Tokenized Vaults | `Vault.daml` - deposit/withdraw/mint/redeem |
| **EIP-7540** | Async Vaults | `AsyncRequests.daml` - request/claim patterns |
| **CIP-0056** | Canton Token Standard | Holdings, TransferFactory, Allocation |
| **CIP-0103** | dApp Standard | Frontend wallet integration |

## API Reference

### Backend Endpoints

```
GET  /api/vaults              # List all vaults
GET  /api/vaults/:id          # Vault details
POST /api/vaults/:id/deposit  # Deposit assets
POST /api/vaults/:id/redeem   # Redeem shares
GET  /api/vaults/:id/holdings/:party  # Share holdings

# CIP-0056 Registry
GET  /registry/v1/metadata
POST /registry/transfer-instruction-v1/transfer-factory
```

### Daml Choices

```daml
-- Vault operations
Vault_Deposit : (ContractId Vault, ContractId VaultShareHolding, Decimal)
Vault_Redeem  : (ContractId Vault, Decimal)
Vault_Mint    : (ContractId Vault, ContractId VaultShareHolding, Decimal)
Vault_Withdraw: (ContractId Vault, Decimal)

-- View functions
Vault_GetTotalAssets : Decimal
Vault_GetTotalShares : Decimal
Vault_GetSharePrice  : Decimal
Vault_ConvertToShares: Decimal -> Decimal
Vault_ConvertToAssets: Decimal -> Decimal

-- Share operations
VaultShareHolding_Split    : (ContractId, ContractId)
VaultShareHolding_Merge    : ContractId
VaultShareHolding_Transfer : ContractId
VaultShareHolding_Lock     : ContractId
VaultShareHolding_Unlock   : ContractId

-- Async operations (EIP-7540)
AsyncRequestFactory_RequestDeposit : ContractId DepositRequest
AsyncRequestFactory_RequestRedeem  : ContractId RedeemRequest
DepositRequest_MakeClaimable      : ContractId DepositRequest
DepositRequest_Claim              : ContractId VaultShareHolding
RedeemRequest_MakeClaimable       : ContractId RedeemRequest
RedeemRequest_Claim               : Decimal
```

## Configuration

### Backend Environment Variables

```bash
PORT=3000                           # Server port
LEDGER_API_URL=http://localhost:6201/v2  # Canton JSON API
LEDGER_ACCESS_TOKEN=                # Optional JWT token
LEDGER_SUBMIT=false                 # Enable ledger writes
```

### Vault Configuration

```daml
VaultConfig with
    underlyingAsset : InstrumentId  -- What the vault holds
    shareInstrumentId : Text        -- Share token identifier
    depositLimit : Optional Decimal -- Max deposits (None=unlimited)
    minDeposit : Decimal            -- Minimum deposit amount
    withdrawalDelay : Optional Int  -- Microseconds (None=sync)
    managementFeeBps : Int          -- Annual fee basis points
    performanceFeeBps : Int         -- Performance fee basis points
```

## Testing

### Run Daml Tests

```bash
daml test
```

### Test Scenarios

1. **Basic Flow**: Create vault → deposit → check shares → redeem
2. **Share Transfer**: FOP transfer between parties
3. **Async Deposit**: Request → process → claim
4. **DVP Settlement**: Allocate → execute

## Deployment

### Canton TestNet

1. Upload DAR to validator node:
   ```bash
   daml build
   # Upload .daml/dist/canton-vault-0.1.0.dar to your validator
   ```

2. Configure backend with testnet credentials

3. Deploy frontend to Vercel/similar

### Canton MainNet

⚠️ Additional steps required:
- Security audit of Daml code
- Regulatory compliance review
- Production monitoring setup

## Contributing

This is an experimental implementation. Issues and PRs welcome!

## License

Apache 2.0

## References

- [CIP-0056: Canton Network Token Standard](https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md)
- [CIP-0103: dApp Standard](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
- [ERC-4626: Tokenized Vaults](https://eips.ethereum.org/EIPS/eip-4626)
- [EIP-7540: Async ERC-4626](https://eips.ethereum.org/EIPS/eip-7540)
- [Splice Token Standard](https://docs.sync.global/app_dev/token_standard/index.html)
- [Canton Daml SDK](https://docs.digitalasset.com/)
