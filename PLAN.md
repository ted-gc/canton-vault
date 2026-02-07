# Canton Vault - Project Plan

**Goal:** Create a fully deployable Canton implementation of ERC-4626 tokenized vaults with EIP-7540 async extensions, compliant with CIP-0056 (Canton Network Token Standard).

## Project Overview

### What We're Building

A **tokenized vault system** for Canton Network that:
- Accepts deposits of CIP-0056 compliant tokens
- Issues vault shares representing proportional ownership
- Supports both synchronous and asynchronous deposit/redemption flows
- Integrates with Canton wallets via CIP-0103 dApp Standard
- Provides a complete frontend for vault interaction

### Standards Compliance

| Standard | Description | Our Implementation |
|----------|-------------|-------------------|
| **ERC-4626** | Tokenized Vaults | Core vault logic (deposit/withdraw/mint/redeem) |
| **EIP-7540** | Async Vaults | Request/claim patterns for delayed operations |
| **CIP-0056** | Canton Token Standard | Implement Holding, TransferInstruction, Allocation interfaces |
| **CIP-0103** | dApp Standard | Wallet integration via Provider API |

---

## Phase 1: Design (This Document + DESIGN.md)

### Key Architectural Decisions

1. **Vault Shares as CIP-0056 Holdings**
   - Vault shares ARE tokens implementing CIP-0056 Holding interface
   - This means vault shares can be used in any CIP-0056 compliant wallet
   - Shares can participate in DVP settlements like any other token

2. **Underlying Assets**
   - Vault accepts any CIP-0056 compliant token as underlying asset
   - Supports Canton Coin (CC) and other tokenized assets

3. **Async Flow for Real-World Asset Vaults**
   - EIP-7540 patterns for when vault investments need time to settle
   - Request → Pending → Claimable → Claimed lifecycle
   - Useful for RWA, cross-chain, or regulatory-delayed operations

4. **Registry Architecture**
   - Vault acts as its own token registry for shares
   - Implements token metadata, holdings, and transfer APIs
   - Exposes HTTP APIs per CIP-0056 requirements

---

## Phase 2: Daml Models

### Core Templates

```
daml/
├── Splice/
│   └── Vault/
│       ├── Types.daml           # Core types (VaultId, ShareAmount, etc.)
│       ├── Vault.daml           # Main vault template
│       ├── VaultShares.daml     # Share token (implements CIP-0056 Holding)
│       ├── VaultFactory.daml    # Factory for creating vaults
│       ├── DepositRequest.daml  # EIP-7540 async deposit request
│       ├── RedeemRequest.daml   # EIP-7540 async redeem request
│       └── Interfaces.daml      # Interface implementations
```

### Key Interfaces to Implement

From CIP-0056:
- `Holding` - For vault shares
- `TransferInstruction` - For FOP transfers of shares
- `TransferFactory` - For creating transfer instructions
- `Allocation` / `AllocationFactory` - For DVP settlement integration

### Vault-Specific Choices

```daml
-- Synchronous operations (ERC-4626)
choice Vault_Deposit : (ContractId VaultShares, Decimal)  -- shares minted
choice Vault_Mint : (ContractId VaultShares, Decimal)     -- assets taken
choice Vault_Withdraw : (ContractId Holding, Decimal)     -- shares burned
choice Vault_Redeem : (ContractId Holding, Decimal)       -- assets returned

-- Async operations (EIP-7540)  
choice Vault_RequestDeposit : ContractId DepositRequest
choice Vault_RequestRedeem : ContractId RedeemRequest
choice DepositRequest_Claim : ContractId VaultShares
choice RedeemRequest_Claim : ContractId Holding

-- View functions
choice Vault_TotalAssets : Decimal
choice Vault_ConvertToShares : Decimal -> Decimal
choice Vault_ConvertToAssets : Decimal -> Decimal
choice Vault_MaxDeposit : Party -> Decimal
choice Vault_MaxWithdraw : Party -> Decimal
```

---

## Phase 3: Backend (Node.js)

### Components

```
backend/
├── src/
│   ├── server.ts           # Express server
│   ├── ledger/
│   │   ├── client.ts       # Canton Ledger API client
│   │   └── auth.ts         # JWT authentication
│   ├── api/
│   │   ├── vault.ts        # Vault operations API
│   │   ├── registry.ts     # CIP-0056 registry endpoints
│   │   └── metadata.ts     # Token metadata API
│   └── services/
│       ├── vault.ts        # Vault business logic
│       └── shares.ts       # Share accounting
├── package.json
└── tsconfig.json
```

### API Endpoints

#### CIP-0056 Registry APIs
- `GET /registry/metadata` - Token metadata
- `POST /registry/transfer-instruction-v1/transfer-factory` - Get TransferFactory
- `POST /registry/allocation-instruction-v1/allocation-factory` - Get AllocationFactory

#### Vault-Specific APIs
- `GET /vault/:id` - Vault info (total assets, share price, etc.)
- `POST /vault/:id/deposit` - Initiate deposit
- `POST /vault/:id/withdraw` - Initiate withdrawal
- `POST /vault/:id/request-deposit` - Async deposit request
- `POST /vault/:id/request-redeem` - Async redeem request
- `GET /vault/:id/requests/:requestId` - Request status

---

## Phase 4: Frontend

### Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **State:** React hooks + TanStack Query
- **Wallet:** CIP-0103 dApp API integration

### Pages

```
frontend/
├── app/
│   ├── page.tsx              # Landing / vault list
│   ├── vault/
│   │   └── [id]/
│   │       ├── page.tsx      # Vault detail
│   │       ├── deposit/      # Deposit flow
│   │       └── withdraw/     # Withdraw flow
│   ├── requests/             # Pending requests
│   └── portfolio/            # User's vault positions
├── components/
│   ├── VaultCard.tsx
│   ├── DepositForm.tsx
│   ├── WithdrawForm.tsx
│   ├── ShareBalance.tsx
│   └── WalletConnect.tsx     # CIP-0103 integration
└── lib/
    ├── dapp-api.ts           # CIP-0103 Provider wrapper
    └── vault-client.ts       # Backend API client
```

### Key Features
- Connect any CIP-0103 compliant wallet
- Real-time vault stats (TVL, share price, APY)
- Transaction history using CIP-0056 transaction parsing
- Pending request management
- Portfolio overview

---

## Phase 5: CIP-0103 dApp Integration

### Provider Implementation

Following the dApp Standard, the frontend will:
1. Discover available wallet providers
2. Connect using `connect()` method
3. Get accounts via `listAccounts()` / `getPrimaryAccount()`
4. Sign transactions via `prepareExecute()`
5. Read ledger state via `ledgerApi()` proxy

### Wallet Gateway Approach

For bonus points, implement server-side async dApp API:
- Backend exposes CIP-0103 async endpoints
- Returns `userUrl` for user approval flows
- Emits events on transaction completion

---

## Phase 6: Testing & Deployment

### Local Testing
1. Use Splice localnet (docker-compose)
2. Deploy Daml packages
3. Run integration tests

### Testnet Deployment
1. Deploy to Canton DevNet/TestNet
2. Upload DAR files to validator node
3. Configure backend with testnet credentials

### Mainnet Preparation
1. Security audit of Daml code
2. Load testing
3. Monitoring setup

---

## Critical Path & Timeline

| Phase | Task | Est. Time |
|-------|------|-----------|
| 1 | Design doc (DESIGN.md) | 2 hours |
| 2 | Daml models - core types & vault | 4 hours |
| 2 | Daml models - CIP-0056 interfaces | 4 hours |
| 2 | Daml models - async requests | 2 hours |
| 3 | Backend - Ledger client | 2 hours |
| 3 | Backend - Registry APIs | 2 hours |
| 3 | Backend - Vault APIs | 3 hours |
| 4 | Frontend - Core pages | 4 hours |
| 4 | Frontend - Wallet integration | 3 hours |
| 5 | Testing & fixes | 4 hours |

**Total estimated: ~30 hours**

---

## Self-Critique & Risks

### Technical Risks
1. **Daml SDK 3.x compatibility** - Need to verify interface syntax for 3.x
2. **CIP-0056 interface complexity** - Factory patterns add ceremony
3. **Async state management** - EIP-7540 adds significant complexity

### Design Questions to Resolve
1. Should vault support multiple underlying assets?
2. How to handle vault fees (management fee, performance fee)?
3. Should shares be transferable? (ERC-4626 says yes via ERC-20)
4. How to handle rounding in share calculations?

### Mitigations
- Start with simple single-asset vault
- Reference Solmate's ERC4626 implementation for rounding
- Use Splice token-standard-test harness for validation

---

## Next Steps

1. ✅ Research complete
2. ⏳ Create DESIGN.md with detailed Daml types
3. ⏳ Setup Daml SDK 3.x
4. ⏳ Implement core Daml models
5. ⏳ Build backend
6. ⏳ Build frontend

---

*Last updated: 2026-02-07*
