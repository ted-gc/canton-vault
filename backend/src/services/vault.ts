import { LedgerClient, Contract } from "../ledger/client.js";

// ===== Types =====

export interface VaultPayload {
  id: { admin: string; name: string };
  config: {
    underlyingAsset: { admin: string; id: string };
    shareInstrumentId: string;
    depositLimit: { Some: string } | null;
    minDeposit: string;
    withdrawalDelay: { Some: number } | null;
    managementFeeBps: number;
    performanceFeeBps: number;
  };
  state: {
    totalAssets: string;
    totalShares: string;
    lastFeeAccrual: string;
  };
  meta: [string, string][];
}

export interface VaultShareHoldingPayload {
  vault: { admin: string; name: string };
  owner: string;
  amount: string;
  holdingLock: { Some: unknown } | null;
  createdAt: string;
  meta: [string, string][];
}

export interface UnderlyingHoldingPayload {
  instrument: { admin: string; id: string };
  owner: string;
  custodian: string;
  amount: string;
  holdingLock: { Some: unknown } | null;
  createdAt: string;
  meta: [string, string][];
}

export interface VaultSummary {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  totalAssets: number;
  totalShares: number;
  sharePrice: number;
  underlyingAsset: string;
  depositLimit: number | null;
  minDeposit: number;
}

export interface VaultHolding {
  contractId: string;
  party: string;
  shares: number;
  value: number;
  locked: boolean;
}

export interface DepositRequest {
  party: string;
  amount: number;
  underlyingHoldingCid?: string;
}

export interface RedeemRequest {
  party: string;
  shares: number;
  shareHoldingCid?: string;
}

// ===== Demo Data (used when ledger unavailable) =====

const demoVaults: VaultSummary[] = [
  {
    id: "vault-1",
    contractId: "demo-vault-1",
    name: "Canton USD Vault",
    symbol: "cUSDv",
    totalAssets: 1_000_000,
    totalShares: 1_000_000,
    sharePrice: 1.0,
    underlyingAsset: "USDC",
    depositLimit: 10_000_000,
    minDeposit: 10,
  },
  {
    id: "vault-2",
    contractId: "demo-vault-2",
    name: "Canton ETH Vault",
    symbol: "cETHv",
    totalAssets: 500,
    totalShares: 475,
    sharePrice: 1.0526,
    underlyingAsset: "ETH",
    depositLimit: null,
    minDeposit: 0.01,
  },
];

// In-memory holdings for demo mode
const demoHoldings: Record<string, Record<string, { shares: number; cid: string }>> = {
  "vault-1": {},
  "vault-2": {},
};

// ===== Service =====

export class VaultService {
  private ledgerAvailable: boolean | null = null;

  constructor(private ledger: LedgerClient) {}

  private async checkLedger(): Promise<boolean> {
    if (this.ledgerAvailable === null) {
      this.ledgerAvailable = await this.ledger.isAvailable();
      console.log(this.ledgerAvailable ? "Ledger connected" : "Demo mode - ledger not available");
    }
    return this.ledgerAvailable;
  }

  // ===== Vault Queries =====

  async listVaults(): Promise<VaultSummary[]> {
    if (!(await this.checkLedger())) {
      return demoVaults;
    }

    const contracts = await this.ledger.queryContracts<VaultPayload>(
      "Splice.Vault.Vault:Vault"
    );

    return contracts.map((c) => this.mapVaultContract(c));
  }

  async getVault(id: string): Promise<VaultSummary | undefined> {
    if (!(await this.checkLedger())) {
      return demoVaults.find((v) => v.id === id);
    }

    const contracts = await this.ledger.queryContracts<VaultPayload>(
      "Splice.Vault.Vault:Vault",
      { "id.name": id }
    );

    if (contracts.length === 0) return undefined;
    return this.mapVaultContract(contracts[0]);
  }

  private mapVaultContract(c: Contract<VaultPayload>): VaultSummary {
    const totalAssets = parseFloat(c.payload.state.totalAssets);
    const totalShares = parseFloat(c.payload.state.totalShares);
    const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1.0;
    const depositLimit = c.payload.config.depositLimit?.Some
      ? parseFloat(c.payload.config.depositLimit.Some)
      : null;

    return {
      id: c.payload.id.name,
      contractId: c.contractId,
      name: c.payload.id.name,
      symbol: c.payload.config.shareInstrumentId,
      totalAssets,
      totalShares,
      sharePrice,
      underlyingAsset: c.payload.config.underlyingAsset.id,
      depositLimit,
      minDeposit: parseFloat(c.payload.config.minDeposit),
    };
  }

  // ===== Holdings =====

  async getHoldings(vaultId: string, party: string): Promise<VaultHolding> {
    if (!(await this.checkLedger())) {
      const h = demoHoldings[vaultId]?.[party];
      const vault = demoVaults.find((v) => v.id === vaultId);
      const value = h ? h.shares * (vault?.sharePrice ?? 1) : 0;
      return {
        contractId: h?.cid ?? "",
        party,
        shares: h?.shares ?? 0,
        value,
        locked: false,
      };
    }

    const contracts = await this.ledger.queryContracts<VaultShareHoldingPayload>(
      "Splice.Vault.VaultShares:VaultShareHolding",
      { owner: party }
    );

    const vaultHoldings = contracts.filter((c) => c.payload.vault.name === vaultId);
    const totalShares = vaultHoldings.reduce(
      (sum, c) => sum + parseFloat(c.payload.amount),
      0
    );
    const hasLocked = vaultHoldings.some((c) => c.payload.holdingLock !== null);
    const vault = await this.getVault(vaultId);
    const value = totalShares * (vault?.sharePrice ?? 1);

    return {
      contractId: vaultHoldings[0]?.contractId ?? "",
      party,
      shares: totalShares,
      value,
      locked: hasLocked,
    };
  }

  // ===== Underlying Holdings =====

  async getUnderlyingHoldings(party: string, instrumentId?: string): Promise<{
    contractId: string;
    instrument: string;
    amount: number;
    locked: boolean;
  }[]> {
    if (!(await this.checkLedger())) {
      return [
        { contractId: "demo-usdc-1", instrument: "USDC", amount: 10000, locked: false },
        { contractId: "demo-eth-1", instrument: "ETH", amount: 5, locked: false },
      ];
    }

    const contracts = await this.ledger.queryContracts<UnderlyingHoldingPayload>(
      "Splice.Vault.UnderlyingHolding:UnderlyingAssetHolding",
      { owner: party }
    );

    return contracts
      .filter((c) => !instrumentId || c.payload.instrument.id === instrumentId)
      .map((c) => ({
        contractId: c.contractId,
        instrument: c.payload.instrument.id,
        amount: parseFloat(c.payload.amount),
        locked: c.payload.holdingLock !== null,
      }));
  }

  // ===== Operations =====

  async deposit(vaultId: string, request: DepositRequest): Promise<{
    status: string;
    shares: number;
    txId?: string;
  }> {
    const vault = await this.getVault(vaultId);
    if (!vault) throw new Error("Vault not found");

    const shares =
      vault.totalShares === 0
        ? request.amount
        : (request.amount * vault.totalShares) / vault.totalAssets;

    if (!(await this.checkLedger())) {
      // Demo mode
      demoHoldings[vaultId] = demoHoldings[vaultId] ?? {};
      const existing = demoHoldings[vaultId][request.party]?.shares ?? 0;
      demoHoldings[vaultId][request.party] = {
        shares: existing + shares,
        cid: `demo-holding-${Date.now()}`,
      };

      const v = demoVaults.find((v) => v.id === vaultId);
      if (v) {
        v.totalAssets += request.amount;
        v.totalShares += shares;
        v.sharePrice = v.totalAssets / v.totalShares;
      }

      return { status: "accepted", shares };
    }

    if (!request.underlyingHoldingCid) {
      throw new Error("underlyingHoldingCid required for ledger deposit");
    }

    const result = await this.ledger.exerciseChoice(
      "Splice.Vault.Vault:Vault",
      vault.contractId,
      "Deposit",
      {
        depositor: request.party,
        receiver: request.party,
        underlyingHoldingCid: request.underlyingHoldingCid,
        depositReason: "User deposit via API",
      },
      [request.party]
    );

    return {
      status: "accepted",
      shares,
      txId: result.result.completionOffset,
    };
  }

  async redeem(vaultId: string, request: RedeemRequest): Promise<{
    status: string;
    assets: number;
    txId?: string;
  }> {
    const vault = await this.getVault(vaultId);
    if (!vault) throw new Error("Vault not found");

    const assets =
      vault.totalAssets === 0
        ? request.shares
        : (request.shares * vault.totalAssets) / vault.totalShares;

    if (!(await this.checkLedger())) {
      // Demo mode
      const h = demoHoldings[vaultId]?.[request.party];
      if (!h || h.shares < request.shares) {
        throw new Error("Insufficient shares");
      }

      h.shares -= request.shares;
      if (h.shares <= 0) {
        delete demoHoldings[vaultId][request.party];
      }

      const v = demoVaults.find((v) => v.id === vaultId);
      if (v) {
        v.totalAssets -= assets;
        v.totalShares -= request.shares;
        v.sharePrice = v.totalShares > 0 ? v.totalAssets / v.totalShares : 1;
      }

      return { status: "accepted", assets };
    }

    const holdings = await this.getHoldings(vaultId, request.party);
    const shareHoldingCid = request.shareHoldingCid ?? holdings.contractId;

    if (!shareHoldingCid) {
      throw new Error("No share holding found");
    }

    const result = await this.ledger.exerciseChoice(
      "Splice.Vault.Vault:Vault",
      vault.contractId,
      "Redeem",
      {
        redeemer: request.party,
        sharesToRedeem: request.shares.toString(),
        receiver: request.party,
        shareHoldingCid,
        redeemReason: "User redemption via API",
      },
      [request.party]
    );

    return {
      status: "accepted",
      assets,
      txId: result.result.completionOffset,
    };
  }
}
