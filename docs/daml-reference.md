# Daml Reference

Complete reference for Canton Vault smart contracts.

## Module Overview

```
daml/
├── Splice/Vault/
│   ├── Types.daml          # Shared types and IDs
│   ├── Vault.daml          # Core vault template (ERC-4626)
│   ├── VaultShares.daml    # Share holdings (CIP-0056)
│   ├── AsyncRequests.daml  # Async patterns (EIP-7540)
│   ├── TransferFactory.daml # Settlement (CIP-0056)
│   └── All.daml            # Module re-exports
└── Test/
    └── VaultTest.daml      # Test scripts
```

---

## Types (Types.daml)

### InstrumentId

Identifies a token/instrument on Canton.

```daml
data InstrumentId = InstrumentId with
    label : Text        -- Human-readable name (e.g., "USDC")
    issuer : Party      -- Issuing party
  deriving (Eq, Show)
```

### VaultConfig

Configuration for a vault.

```daml
data VaultConfig = VaultConfig with
    underlyingAsset : InstrumentId     -- What the vault accepts
    shareInstrumentId : Text           -- Share token symbol
    depositLimit : Optional Decimal    -- Max deposits (None = unlimited)
    minDeposit : Decimal               -- Minimum deposit amount
    withdrawalDelay : Optional Int     -- Microseconds (None = sync)
    managementFeeBps : Int             -- Annual fee in basis points
    performanceFeeBps : Int            -- Performance fee in basis points
  deriving (Eq, Show)
```

### LockInfo

Lock state for holdings.

```daml
data LockInfo = LockInfo with
    lockType : LockType
    context : Text           -- Settlement ID or reason
    expiresAt : Optional Time
  deriving (Eq, Show)

data LockType 
    = AllocationLock    -- Locked for DVP
    | TimeLock          -- Time-based lock
    | RegulatoryLock    -- Compliance hold
  deriving (Eq, Show)
```

### RequestStatus

Status for async requests.

```daml
data RequestStatus
    = Pending
    | Processing
    | Claimable
    | Claimed
    | Cancelled
  deriving (Eq, Show)
```

---

## Vault (Vault.daml)

Core vault template implementing ERC-4626.

### Template

```daml
template Vault
  with
    operator : Party                 -- Vault operator
    config : VaultConfig             -- Vault configuration
    totalAssets : Decimal            -- Total underlying assets
    totalShares : Decimal            -- Total shares outstanding
    lastAccrualTime : Time           -- Last fee accrual
  where
    signatory operator
    
    -- View: anyone with party ID can observe
    observer config.underlyingAsset.issuer
```

### Choices

#### Vault_Deposit

Deposit assets, receive shares.

```daml
choice Vault_Deposit : (ContractId Vault, ContractId VaultShareHolding, Decimal)
  with
    depositor : Party
    assets : Decimal
  controller depositor
  do
    -- Validation
    assertMsg "Below minimum" (assets >= config.minDeposit)
    case config.depositLimit of
      Some limit -> assertMsg "Exceeds limit" (totalAssets + assets <= limit)
      None -> return ()
    
    -- Calculate shares
    let shares = convertToShares this assets
    
    -- Update vault
    newVault <- create this with
      totalAssets = totalAssets + assets
      totalShares = totalShares + shares
    
    -- Create holding
    holding <- create VaultShareHolding with
      owner = depositor
      vault = operator
      instrument = config.shareInstrumentId
      amount = shares
      lock = None
    
    return (newVault, holding, shares)
```

#### Vault_Redeem

Redeem shares for assets.

```daml
choice Vault_Redeem : (ContractId Vault, Decimal)
  with
    redeemer : Party
    shares : Decimal
    holdingCid : ContractId VaultShareHolding
  controller redeemer
  do
    holding <- fetch holdingCid
    assertMsg "Not owner" (holding.owner == redeemer)
    assertMsg "Insufficient" (holding.amount >= shares)
    assertMsg "Locked" (holding.lock == None)
    
    let assets = convertToAssets this shares
    
    newVault <- create this with
      totalAssets = totalAssets - assets
      totalShares = totalShares - shares
    
    -- Update or archive holding
    if holding.amount == shares
      then archive holdingCid
      else create holding with amount = holding.amount - shares
    
    return (newVault, assets)
```

#### Vault_Mint

Mint specific shares (specify shares, calculate assets needed).

```daml
choice Vault_Mint : (ContractId Vault, ContractId VaultShareHolding, Decimal)
  with
    depositor : Party
    shares : Decimal
  controller depositor
  do
    let assets = convertToAssets this shares
    -- Similar to deposit...
```

#### Vault_Withdraw

Withdraw specific assets (specify assets, calculate shares to burn).

```daml
choice Vault_Withdraw : (ContractId Vault, Decimal)
  with
    redeemer : Party
    assets : Decimal
    holdingCid : ContractId VaultShareHolding
  controller redeemer
  do
    let shares = convertToShares this assets
    -- Similar to redeem...
```

#### View Functions

```daml
-- Get current share price
choice Vault_GetSharePrice : Decimal
  controller operator
  do
    return (if totalShares == 0.0 then 1.0 else totalAssets / totalShares)

-- Convert assets to shares
choice Vault_ConvertToShares : Decimal
  with
    assets : Decimal
  controller operator
  do
    return (convertToShares this assets)

-- Convert shares to assets
choice Vault_ConvertToAssets : Decimal
  with
    shares : Decimal
  controller operator
  do
    return (convertToAssets this shares)
```

### Helper Functions

```daml
convertToShares : Vault -> Decimal -> Decimal
convertToShares vault assets =
  if vault.totalAssets == 0.0
    then assets
    else assets * (vault.totalShares / vault.totalAssets)

convertToAssets : Vault -> Decimal -> Decimal
convertToAssets vault shares =
  if vault.totalShares == 0.0
    then shares
    else shares * (vault.totalAssets / vault.totalShares)
```

---

## VaultShares (VaultShares.daml)

Share holdings implementing CIP-0056.

### Template

```daml
template VaultShareHolding
  with
    owner : Party                    -- Holder's party ID
    vault : Party                    -- Vault operator
    instrument : Text                -- Share instrument ID
    amount : Decimal                 -- Number of shares
    lock : Optional LockInfo         -- Lock state
  where
    signatory vault, owner
```

### Choices

#### VaultShareHolding_Split

Split holding into two.

```daml
choice VaultShareHolding_Split : (ContractId VaultShareHolding, ContractId VaultShareHolding)
  with
    splitAmount : Decimal
  controller owner
  do
    assertMsg "Invalid split" (splitAmount > 0.0 && splitAmount < amount)
    assertMsg "Locked" (lock == None)
    
    archive self
    h1 <- create this with amount = splitAmount
    h2 <- create this with amount = amount - splitAmount
    return (h1, h2)
```

#### VaultShareHolding_Merge

Merge with another holding.

```daml
choice VaultShareHolding_Merge : ContractId VaultShareHolding
  with
    otherCid : ContractId VaultShareHolding
  controller owner
  do
    other <- fetch otherCid
    assertMsg "Different owner" (other.owner == owner)
    assertMsg "Different instrument" (other.instrument == instrument)
    assertMsg "Locked" (lock == None && other.lock == None)
    
    archive self
    archive otherCid
    create this with amount = amount + other.amount
```

#### VaultShareHolding_Transfer

Transfer to another party (FOP).

```daml
choice VaultShareHolding_Transfer : ContractId VaultShareHolding
  with
    newOwner : Party
  controller owner
  do
    assertMsg "Locked" (lock == None)
    archive self
    create this with owner = newOwner
```

#### VaultShareHolding_Lock

Lock for settlement.

```daml
choice VaultShareHolding_Lock : ContractId VaultShareHolding
  with
    lockInfo : LockInfo
  controller vault
  do
    assertMsg "Already locked" (lock == None)
    archive self
    create this with lock = Some lockInfo
```

#### VaultShareHolding_Unlock

Remove lock.

```daml
choice VaultShareHolding_Unlock : ContractId VaultShareHolding
  controller vault
  do
    assertMsg "Not locked" (lock /= None)
    archive self
    create this with lock = None
```

---

## AsyncRequests (AsyncRequests.daml)

EIP-7540 async patterns.

### DepositRequest

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
        assertMsg "Not pending" (status == Pending || status == Processing)
        create this with 
          status = Claimable
          claimableShares = Some shares
    
    choice DepositRequest_Claim : ContractId VaultShareHolding
      controller depositor
      do
        assertMsg "Not claimable" (status == Claimable)
        create VaultShareHolding with
          owner = depositor
          vault = vault
          instrument = "vault-shares"  -- From vault config
          amount = fromSome claimableShares
          lock = None
    
    choice DepositRequest_Cancel : ()
      controller depositor
      do
        assertMsg "Cannot cancel" (status == Pending)
        return ()
```

### RedeemRequest

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
        assertMsg "Not claimable" (status == Claimable)
        archive lockedHoldingCid
        return (fromSome claimableAssets)
    
    choice RedeemRequest_Cancel : ContractId VaultShareHolding
      controller redeemer
      do
        assertMsg "Cannot cancel" (status == Pending)
        holding <- fetch lockedHoldingCid
        create holding with lock = None
```

### AsyncRequestFactory

Factory for creating async requests.

```daml
template AsyncRequestFactory
  with
    vault : Party
  where
    signatory vault
    
    nonconsuming choice AsyncRequestFactory_RequestDeposit : ContractId DepositRequest
      with
        depositor : Party
        assets : Decimal
      controller depositor
      do
        now <- getTime
        create DepositRequest with
          vault = vault
          depositor = depositor
          assets = assets
          requestTime = now
          status = Pending
          claimableShares = None
    
    nonconsuming choice AsyncRequestFactory_RequestRedeem : ContractId RedeemRequest
      with
        redeemer : Party
        shares : Decimal
        holdingCid : ContractId VaultShareHolding
      controller redeemer
      do
        -- Lock the holding
        holding <- fetch holdingCid
        lockedCid <- exercise holdingCid VaultShareHolding_Lock with
          lockInfo = LockInfo AllocationLock "redeem-request" None
        
        now <- getTime
        create RedeemRequest with
          vault = vault
          redeemer = redeemer
          shares = shares
          lockedHoldingCid = lockedCid
          requestTime = now
          status = Pending
          claimableAssets = None
```

---

## TransferFactory (TransferFactory.daml)

CIP-0056 settlement patterns.

### TransferInstruction

```daml
template TransferInstruction
  with
    sender : Party
    receiver : Party
    instrument : Text
    amount : Decimal
    operator : Party
    settlementId : Text
    mode : SettlementMode
    status : SettlementStatus
  where
    signatory operator, sender
    observer receiver
    
    choice TransferInstruction_Execute : ContractId VaultShareHolding
      with
        holdingCid : ContractId VaultShareHolding
      controller sender
      do
        holding <- fetch holdingCid
        assertMsg "Wrong instrument" (holding.instrument == instrument)
        assertMsg "Insufficient" (holding.amount >= amount)
        
        if holding.amount == amount
          then do
            archive holdingCid
            create holding with owner = receiver
          else do
            create holding with amount = holding.amount - amount
            create holding with owner = receiver, amount = amount
```

### DVP Settlement

```daml
template DVPSettlement
  with
    operator : Party
    settlementId : Text
    deliveryLeg : TransferLeg
    paymentLeg : TransferLeg
    deliveryAllocated : Optional (ContractId VaultShareHolding)
    paymentAllocated : Optional (ContractId VaultShareHolding)
    deadline : Time
  where
    signatory operator
    observer deliveryLeg.sender, deliveryLeg.receiver, 
             paymentLeg.sender, paymentLeg.receiver
    
    choice DVPSettlement_AllocateDelivery : ContractId DVPSettlement
      with
        holdingCid : ContractId VaultShareHolding
      controller deliveryLeg.sender
      do
        -- Lock and record allocation
        lockedCid <- exercise holdingCid VaultShareHolding_Lock with
          lockInfo = LockInfo AllocationLock settlementId (Some deadline)
        create this with deliveryAllocated = Some lockedCid
    
    choice DVPSettlement_AllocatePayment : ContractId DVPSettlement
      with
        holdingCid : ContractId VaultShareHolding
      controller paymentLeg.sender
      do
        lockedCid <- exercise holdingCid VaultShareHolding_Lock with
          lockInfo = LockInfo AllocationLock settlementId (Some deadline)
        create this with paymentAllocated = Some lockedCid
    
    choice DVPSettlement_Settle : (ContractId VaultShareHolding, ContractId VaultShareHolding)
      controller operator
      do
        -- Verify both allocated
        deliveryCid <- fromSomeNote "Delivery not allocated" deliveryAllocated
        paymentCid <- fromSomeNote "Payment not allocated" paymentAllocated
        
        -- Execute atomic swap
        newDelivery <- exercise deliveryCid VaultShareHolding_Transfer with
          newOwner = deliveryLeg.receiver
        newPayment <- exercise paymentCid VaultShareHolding_Transfer with
          newOwner = paymentLeg.receiver
        
        return (newDelivery, newPayment)
```

---

## Testing (VaultTest.daml)

Example test script:

```daml
testDepositRedeem = script do
  -- Setup parties
  operator <- allocateParty "VaultOperator"
  alice <- allocateParty "Alice"
  
  -- Create vault
  vaultCid <- submit operator do
    createCmd Vault with
      operator
      config = VaultConfig with
        underlyingAsset = InstrumentId "USDC" operator
        shareInstrumentId = "cUSDv"
        depositLimit = None
        minDeposit = 10.0
        withdrawalDelay = None
        managementFeeBps = 0
        performanceFeeBps = 0
      totalAssets = 0.0
      totalShares = 0.0
      lastAccrualTime = time (date 2024 Jan 1) 0 0 0
  
  -- Alice deposits
  (vaultCid, holdingCid, shares) <- submit alice do
    exerciseCmd vaultCid Vault_Deposit with
      depositor = alice
      assets = 1000.0
  
  -- Verify shares
  holding <- queryContractId alice holdingCid
  assertMsg "Wrong shares" (holding.amount == 1000.0)
  
  -- Alice redeems half
  (vaultCid, assets) <- submit alice do
    exerciseCmd vaultCid Vault_Redeem with
      redeemer = alice
      shares = 500.0
      holdingCid
  
  -- Verify assets
  assertMsg "Wrong assets" (assets == 500.0)
  
  return ()
```

Run tests:
```bash
daml test
```
