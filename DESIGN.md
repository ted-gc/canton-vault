# Canton Vault - Technical Design

This document provides detailed technical specifications for the Canton Vault implementation.

## 1. Core Concepts

### 1.1 Vault Mechanics (ERC-4626 Mapping)

| ERC-4626 Concept | Canton Implementation |
|------------------|----------------------|
| `asset` | Underlying CIP-0056 token (e.g., Canton Coin) |
| `share` | Vault share token (also CIP-0056 compliant) |
| `totalAssets()` | Sum of all underlying holdings owned by vault |
| `totalSupply()` | Sum of all vault shares outstanding |
| `convertToShares(assets)` | `assets * totalShares / totalAssets` |
| `convertToAssets(shares)` | `shares * totalAssets / totalShares` |

### 1.2 Share Price Calculation

```
sharePrice = totalAssets / totalShares

-- On deposit:
sharesToMint = depositAmount / sharePrice
            = depositAmount * totalShares / totalAssets

-- On redeem:
assetsToReturn = sharesToRedeem * sharePrice
              = sharesToRedeem * totalAssets / totalShares
```

**Rounding Rules (per ERC-4626):**
- `deposit` / `mint`: Round DOWN shares (favor vault)
- `withdraw` / `redeem`: Round DOWN assets (favor vault)
- Always favor the vault to prevent economic attacks

---

## 2. Daml Type Definitions

### 2.1 Core Types

```daml
-- Types.daml

module Splice.Vault.Types where

import DA.Time

-- Unique identifier for a vault
data VaultId = VaultId with
    admin : Party          -- Vault administrator
    name : Text            -- Human-readable name
  deriving (Eq, Show)

-- Instrument identifier (from CIP-0056)
data InstrumentId = InstrumentId with
    admin : Party          -- Token registry admin
    id : Text              -- Token identifier (e.g., "Amulet", "USDC")
  deriving (Eq, Show)

-- Vault configuration
data VaultConfig = VaultConfig with
    underlyingAsset : InstrumentId     -- What the vault holds
    shareInstrument : InstrumentId     -- Vault share token identity
    depositLimit : Optional Decimal    -- Max total deposits (None = unlimited)
    withdrawalDelay : Optional RelTime -- For async vaults
    managementFee : Decimal            -- Annual fee in basis points (e.g., 200 = 2%)
    performanceFee : Decimal           -- Fee on profits in basis points
  deriving (Eq, Show)

-- Vault state snapshot
data VaultState = VaultState with
    totalAssets : Decimal     -- Total underlying assets
    totalShares : Decimal     -- Total shares outstanding
    lastFeeAccrual : Time     -- Last time fees were accrued
  deriving (Eq, Show)

-- Request status for async operations
data RequestStatus 
    = Pending
    | Claimable
    | Claimed
    | Cancelled
  deriving (Eq, Show)
```

### 2.2 Vault Share Holding

Vault shares implement the CIP-0056 `Holding` interface so they work with any Canton wallet.

```daml
-- VaultShares.daml

module Splice.Vault.VaultShares where

import Splice.Api.Token.HoldingV1
import Splice.Vault.Types

-- Vault share holding (implements CIP-0056 Holding interface)
template VaultShareHolding
  with
    vault : VaultId
    owner : Party
    amount : Decimal
    createdAt : Time
    meta : [(Text, Text)]   -- Generic metadata per CIP-0056
  where
    signatory vault.admin, owner
    
    -- CIP-0056 Holding interface implementation
    interface instance Holding for VaultShareHolding where
      view = HoldingView with
        instrument = InstrumentId vault.admin (vault.name <> "-SHARES")
        owner = owner
        amount = amount
        lock = None          -- Shares are unlocked by default
        meta = meta

    -- Split holding into two
    choice VaultShareHolding_Split : (ContractId VaultShareHolding, ContractId VaultShareHolding)
      with
        splitAmount : Decimal
      controller owner
      do
        assertMsg "Split amount must be positive" (splitAmount > 0.0)
        assertMsg "Split amount must be less than total" (splitAmount < amount)
        
        now <- getTime
        h1 <- create this with amount = splitAmount, createdAt = now
        h2 <- create this with amount = amount - splitAmount, createdAt = now
        return (h1, h2)

    -- Merge with another holding
    choice VaultShareHolding_Merge : ContractId VaultShareHolding
      with
        otherCid : ContractId VaultShareHolding
      controller owner
      do
        other <- fetch otherCid
        assertMsg "Same vault required" (other.vault == vault)
        assertMsg "Same owner required" (other.owner == owner)
        archive otherCid
        
        now <- getTime
        create this with 
          amount = amount + other.amount
          createdAt = now
```

### 2.3 Main Vault Template

```daml
-- Vault.daml

module Splice.Vault.Vault where

import Splice.Api.Token.HoldingV1
import Splice.Api.Token.TransferInstructionV1
import Splice.Vault.Types
import Splice.Vault.VaultShares

-- Main vault contract
template Vault
  with
    id : VaultId
    config : VaultConfig
    state : VaultState
    meta : [(Text, Text)]
  where
    signatory id.admin
    
    -- Read current vault state
    nonconsuming choice Vault_GetState : VaultState
      controller id.admin
      do return state

    -- Calculate shares for given assets (view function)
    nonconsuming choice Vault_ConvertToShares : Decimal
      with
        assets : Decimal
      controller id.admin
      do
        if state.totalShares == 0.0 
          then return assets  -- 1:1 for first deposit
          else return $ roundDown $ assets * state.totalShares / state.totalAssets

    -- Calculate assets for given shares (view function)
    nonconsuming choice Vault_ConvertToAssets : Decimal
      with
        shares : Decimal
      controller id.admin
      do
        if state.totalAssets == 0.0
          then return shares  -- 1:1 edge case
          else return $ roundDown $ shares * state.totalAssets / state.totalShares

    -- Deposit assets, receive shares
    choice Vault_Deposit : (ContractId Vault, ContractId VaultShareHolding, Decimal)
      with
        depositor : Party
        assetHoldingCid : ContractId Holding  -- CIP-0056 Holding of underlying
        depositAmount : Decimal
      controller depositor, id.admin
      do
        -- Verify the holding
        holding <- fetch assetHoldingCid
        let holdingView = view holding
        assertMsg "Wrong asset type" (holdingView.instrument == config.underlyingAsset)
        assertMsg "Insufficient balance" (holdingView.amount >= depositAmount)
        
        -- Calculate shares to mint
        sharesToMint <- exercise self Vault_ConvertToShares with assets = depositAmount
        assertMsg "Would mint zero shares" (sharesToMint > 0.0)
        
        -- Transfer assets to vault (via CIP-0056 transfer)
        -- Note: In real impl, use TransferFactory pattern
        -- Simplified here - would archive input holding, create new ones
        
        -- Create share holding for depositor
        now <- getTime
        sharesCid <- create VaultShareHolding with
          vault = id
          owner = depositor
          amount = sharesToMint
          createdAt = now
          meta = [("splice.lfdecentralizedtrust.org/tx-kind", "mint")]
        
        -- Update vault state
        newVault <- create this with
          state = state with
            totalAssets = state.totalAssets + depositAmount
            totalShares = state.totalShares + sharesToMint
        
        return (newVault, sharesCid, sharesToMint)

    -- Redeem shares for assets
    choice Vault_Redeem : (ContractId Vault, ContractId Holding, Decimal)
      with
        redeemer : Party
        shareHoldingCid : ContractId VaultShareHolding
        redeemAmount : Decimal
      controller redeemer, id.admin
      do
        -- Verify share holding
        shareHolding <- fetch shareHoldingCid
        assertMsg "Not owner" (shareHolding.owner == redeemer)
        assertMsg "Wrong vault" (shareHolding.vault == id)
        assertMsg "Insufficient shares" (shareHolding.amount >= redeemAmount)
        
        -- Calculate assets to return
        assetsToReturn <- exercise self Vault_ConvertToAssets with shares = redeemAmount
        assertMsg "Would return zero assets" (assetsToReturn > 0.0)
        assertMsg "Vault has insufficient assets" (state.totalAssets >= assetsToReturn)
        
        -- Archive/reduce share holding
        archive shareHoldingCid
        when (shareHolding.amount > redeemAmount) do
          now <- getTime
          void $ create shareHolding with 
            amount = shareHolding.amount - redeemAmount
            createdAt = now
          return ()
        
        -- Create asset holding for redeemer
        -- Note: Simplified - real impl creates CIP-0056 compliant holding
        now <- getTime
        assetCid <- create ... -- underlying asset holding
        
        -- Update vault state
        newVault <- create this with
          state = state with
            totalAssets = state.totalAssets - assetsToReturn
            totalShares = state.totalShares - redeemAmount
        
        return (newVault, assetCid, assetsToReturn)

-- Helper for ERC-4626 rounding
roundDown : Decimal -> Decimal
roundDown d = truncate d -- Always round toward zero (favor vault)
```

### 2.4 Async Request Templates (EIP-7540)

```daml
-- DepositRequest.daml

module Splice.Vault.DepositRequest where

import Splice.Vault.Types

-- Async deposit request (EIP-7540)
template DepositRequest
  with
    requestId : Text
    vault : VaultId
    controller : Party        -- Who can claim
    owner : Party             -- Who provided assets
    assets : Decimal          -- Amount deposited
    status : RequestStatus
    deadline : Time           -- When request expires
    claimableShares : Optional Decimal  -- Set when status = Claimable
    meta : [(Text, Text)]
  where
    signatory vault.admin, controller
    observer owner
    
    -- Vault admin marks request as claimable
    choice DepositRequest_MakeClaimable : ContractId DepositRequest
      with
        shares : Decimal
      controller vault.admin
      do
        assertMsg "Not pending" (status == Pending)
        create this with 
          status = Claimable
          claimableShares = Some shares

    -- Controller claims shares
    choice DepositRequest_Claim : ContractId VaultShareHolding
      controller controller
      do
        assertMsg "Not claimable" (status == Claimable)
        shares <- case claimableShares of
          Some s -> return s
          None -> abort "No claimable shares"
        
        now <- getTime
        create VaultShareHolding with
          vault = vault
          owner = controller
          amount = shares
          createdAt = now
          meta = [("splice.lfdecentralizedtrust.org/tx-kind", "mint"),
                  ("requestId", requestId)]

    -- Cancel expired request (returns assets to owner)
    choice DepositRequest_Cancel : ()
      with
        reason : Text
      controller controller
      do
        now <- getTime
        assertMsg "Not expired" (now > deadline || status == Pending)
        -- Note: Would trigger return of assets to owner
        return ()


-- Async redeem request (EIP-7540)
template RedeemRequest
  with
    requestId : Text
    vault : VaultId
    controller : Party
    owner : Party             -- Who provided shares
    shares : Decimal          -- Shares to redeem
    status : RequestStatus
    deadline : Time
    claimableAssets : Optional Decimal
    meta : [(Text, Text)]
  where
    signatory vault.admin, controller
    observer owner
    
    choice RedeemRequest_MakeClaimable : ContractId RedeemRequest
      with
        assets : Decimal
      controller vault.admin
      do
        assertMsg "Not pending" (status == Pending)
        create this with
          status = Claimable
          claimableAssets = Some assets

    choice RedeemRequest_Claim : ContractId Holding
      controller controller
      do
        assertMsg "Not claimable" (status == Claimable)
        assets <- case claimableAssets of
          Some a -> return a
          None -> abort "No claimable assets"
        -- Create underlying asset holding for controller
        -- ... implementation
```

---

## 3. CIP-0056 Interface Implementations

### 3.1 TransferFactory for Vault Shares

```daml
-- Interfaces.daml

module Splice.Vault.Interfaces where

import Splice.Api.Token.TransferInstructionV1
import Splice.Vault.Types
import Splice.Vault.VaultShares

-- Factory for creating vault share transfers
template VaultShareTransferFactory
  with
    vault : VaultId
    meta : [(Text, Text)]
  where
    signatory vault.admin
    
    interface instance TransferFactory for VaultShareTransferFactory where
      view = TransferFactoryView with
        provider = vault.admin
        instrument = InstrumentId vault.admin (vault.name <> "-SHARES")
        meta = meta

    -- Create a transfer instruction
    nonconsuming choice VaultShareTransferFactory_Transfer : ContractId TransferInstruction
      with
        sender : Party
        receiver : Party
        amount : Decimal
        senderHoldings : [ContractId VaultShareHolding]
        deadline : Time
        context : TransferContext
      controller sender
      do
        -- Validate holdings
        holdingAmounts <- forA senderHoldings \cid -> do
          h <- fetch cid
          assertMsg "Wrong vault" (h.vault == vault)
          assertMsg "Not owner" (h.owner == sender)
          return h.amount
        let totalAvailable = sum holdingAmounts
        assertMsg "Insufficient holdings" (totalAvailable >= amount)
        
        -- Create transfer instruction
        create VaultShareTransferInstruction with
          vault = vault
          sender = sender
          receiver = receiver
          amount = amount
          inputHoldings = senderHoldings
          deadline = deadline
          status = InstructionPending
          meta = context.meta

-- Transfer instruction for vault shares
template VaultShareTransferInstruction
  with
    vault : VaultId
    sender : Party
    receiver : Party
    amount : Decimal
    inputHoldings : [ContractId VaultShareHolding]
    deadline : Time
    status : InstructionStatus
    meta : [(Text, Text)]
  where
    signatory vault.admin, sender
    observer receiver
    
    interface instance TransferInstruction for VaultShareTransferInstruction where
      view = TransferInstructionView with
        instrument = InstrumentId vault.admin (vault.name <> "-SHARES")
        sender = sender
        receiver = receiver
        amount = amount
        deadline = deadline
        status = status
        meta = meta

    -- Execute the transfer
    choice VaultShareTransferInstruction_Execute : (ContractId VaultShareHolding)
      controller receiver, vault.admin
      do
        now <- getTime
        assertMsg "Deadline passed" (now <= deadline)
        
        -- Archive input holdings, create new ones
        forA_ inputHoldings archive
        
        create VaultShareHolding with
          vault = vault
          owner = receiver
          amount = amount
          createdAt = now
          meta = [("splice.lfdecentralizedtrust.org/tx-kind", "transfer")]
```

---

## 4. Backend API Design

### 4.1 REST Endpoints

```typescript
// Registry endpoints (CIP-0056)
GET  /registry/v1/metadata
POST /registry/transfer-instruction-v1/transfer-factory
POST /registry/allocation-instruction-v1/allocation-factory

// Vault-specific endpoints
GET  /api/vaults                          // List all vaults
GET  /api/vaults/:id                      // Vault details
GET  /api/vaults/:id/holdings/:party      // Party's share holdings
POST /api/vaults/:id/deposit              // Sync deposit
POST /api/vaults/:id/redeem               // Sync redeem
POST /api/vaults/:id/request-deposit      // Async deposit request
POST /api/vaults/:id/request-redeem       // Async redeem request
GET  /api/vaults/:id/requests/:requestId  // Request status
GET  /api/vaults/:id/history/:party       // Transaction history
```

### 4.2 Ledger API Integration

```typescript
// Backend uses Canton JSON Ledger API
interface LedgerClient {
  // Read contracts
  queryContracts(party: string, interfaceId: string): Promise<Contract[]>;
  getContractById(contractId: string): Promise<Contract>;
  
  // Write transactions
  prepare(commands: Command[]): Promise<PreparedTransaction>;
  execute(preparedTx: PreparedTransaction, signature: string): Promise<Result>;
  submitAndWait(commands: Command[]): Promise<Result>;
  
  // Streams
  subscribeToUpdates(party: string, filter: Filter): Observable<Update>;
}
```

---

## 5. Frontend Components

### 5.1 Key Components

```typescript
// VaultCard - displays vault summary
interface VaultCardProps {
  vault: Vault;
  userShares?: Decimal;
}

// DepositForm - deposit flow
interface DepositFormProps {
  vault: Vault;
  availableAssets: Holding[];
  onDeposit: (amount: Decimal) => Promise<void>;
}

// ShareBalance - user's vault position
interface ShareBalanceProps {
  vault: Vault;
  shares: Decimal;
  valueInAssets: Decimal;
}

// RequestList - pending async requests
interface RequestListProps {
  requests: (DepositRequest | RedeemRequest)[];
  onClaim: (requestId: string) => Promise<void>;
}
```

### 5.2 CIP-0103 Provider Integration

```typescript
// dapp-api.ts
import { Provider, RequestPayload } from './types';

export class CantonProvider implements Provider {
  async request<T>(args: RequestPayload): Promise<T> {
    // Dispatch to wallet provider
  }
  
  async connect(): Promise<ConnectResult> {
    return this.request({ method: 'connect' });
  }
  
  async getPrimaryAccount(): Promise<Account> {
    return this.request({ method: 'getPrimaryAccount' });
  }
  
  async prepareExecute(commands: Command[]): Promise<void> {
    return this.request({ 
      method: 'prepareExecute',
      params: { commands }
    });
  }
  
  async ledgerApi(request: LedgerApiRequest): Promise<LedgerApiResponse> {
    return this.request({
      method: 'ledgerApi',
      params: request
    });
  }
}
```

---

## 6. Security Considerations

### 6.1 Economic Security

1. **Inflation attacks**: First depositor attack mitigated by:
   - Minimum initial deposit requirement
   - Virtual shares (dead shares at creation)

2. **Rounding exploitation**: All calculations favor the vault

3. **Share price manipulation**: Use time-weighted pricing for large operations

### 6.2 Access Control

1. Vault admin can:
   - Update vault configuration
   - Process async requests
   - Emergency pause

2. Users can:
   - Deposit/withdraw their own assets
   - Transfer their own shares
   - Claim their own requests

### 6.3 Privacy

- Holdings are private to owner + vault admin
- Transaction history only visible to stakeholders
- No public total supply (per CIP-0056 design)

---

## 7. Testing Strategy

### 7.1 Daml Script Tests

```daml
-- Test basic deposit/redeem cycle
testBasicVault = script do
  admin <- allocateParty "Admin"
  alice <- allocateParty "Alice"
  
  -- Create vault
  vaultCid <- submit admin do
    createCmd Vault with ...
  
  -- Alice deposits
  (vaultCid', sharesCid, sharesAmount) <- submit alice do
    exerciseCmd vaultCid Vault_Deposit with
      depositor = alice
      depositAmount = 100.0
      ...
  
  -- Verify shares received
  shares <- query @VaultShareHolding alice
  assertEq (length shares) 1
  assertEq (fst (head shares)).amount 100.0  -- 1:1 for first deposit
```

### 7.2 Integration Tests

1. Full deposit/redeem cycle
2. Share transfers between parties
3. Async request lifecycle
4. DVP settlement with vault shares
5. Multi-party scenarios

---

*Document version: 1.0 | Last updated: 2026-02-07*
