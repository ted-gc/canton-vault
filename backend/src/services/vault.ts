import { LedgerClient, Contract } from "../ledger/client.js";

const VAULT_TEMPLATE = "Splice.Vault.Vault:Vault";
const SHARE_HOLDING_TEMPLATE = "Splice.Vault.VaultShares:VaultShareHolding";

export interface VaultSummary {
  id: string;
  name: string;
  totalAssets: number;
  totalShares: number;
  sharePrice: number;
}

export interface VaultHolding {
  party: string;
  shares: number;
}

export interface DepositRequest {
  party: string;
  amount: number;
  underlyingHoldingCid: string;
  receiver?: string;
  reason?: string;
}

export interface RedeemRequest {
  party: string;
  shares: number;
  shareHoldingCid: string;
  receiver?: string;
  reason?: string;
}

type VaultPayload = {
  id?: { admin?: string; name?: string };
  state?: { totalAssets?: string | number; totalShares?: string | number };
};

type HoldingPayload = {
  vault?: { name?: string };
  owner?: string;
  amount?: string | number;
};

const toNumber = (value: string | number | undefined): number => {
  if (value === undefined) return 0;
  return typeof value === "string" ? Number(value) : value;
};

export class VaultService {
  constructor(private ledger: LedgerClient) {}

  private async getVaultContracts(): Promise<Contract<VaultPayload>[]> {
    return this.ledger.queryContracts<VaultPayload>(VAULT_TEMPLATE);
  }

  private async findVaultContract(vaultId: string): Promise<Contract<VaultPayload>> {
    const vaults = await this.getVaultContracts();
    const match = vaults.find(
      (vault) => vault.contractId === vaultId || vault.payload?.id?.name === vaultId
    );
    if (!match) throw new Error("Vault not found");
    return match;
  }

  async listVaults(): Promise<VaultSummary[]> {
    const vaults = await this.getVaultContracts();
    return vaults.map((vault) => {
      const totalAssets = toNumber(vault.payload?.state?.totalAssets);
      const totalShares = toNumber(vault.payload?.state?.totalShares);
      const sharePrice = totalShares === 0 ? 1 : totalAssets / totalShares;
      const name = vault.payload?.id?.name ?? vault.contractId;

      return {
        id: vault.contractId,
        name,
        totalAssets,
        totalShares,
        sharePrice,
      };
    });
  }

  async getVault(id: string): Promise<VaultSummary | undefined> {
    const vaults = await this.listVaults();
    return vaults.find((vault) => vault.id === id || vault.name === id);
  }

  async getHoldings(vaultId: string, party: string): Promise<VaultHolding> {
    const vault = await this.findVaultContract(vaultId);
    const vaultName = vault.payload?.id?.name ?? vaultId;

    const holdings = await this.ledger.queryContracts<HoldingPayload>(SHARE_HOLDING_TEMPLATE, {
      owner: party,
    });

    const shares = holdings
      .filter((holding) => holding.payload?.vault?.name === vaultName)
      .reduce((sum, holding) => sum + toNumber(holding.payload?.amount), 0);

    return { party, shares };
  }

  async deposit(vaultId: string, request: DepositRequest): Promise<unknown> {
    if (!request.underlyingHoldingCid) {
      throw new Error("underlyingHoldingCid is required");
    }

    const vault = await this.findVaultContract(vaultId);
    const vaultAdmin = vault.payload?.id?.admin;
    const actAs = [request.party, vaultAdmin].filter(Boolean) as string[];

    const response = await this.ledger.exerciseChoice(
      VAULT_TEMPLATE,
      vault.contractId,
      "Deposit",
      {
        depositor: request.party,
        depositAmount: request.amount.toString(),
        receiver: request.receiver ?? request.party,
        depositReason: request.reason ?? "user deposit",
        underlyingHoldingCid: request.underlyingHoldingCid,
      },
      actAs
    );

    return {
      status: "submitted",
      vaultId: vault.contractId,
      party: request.party,
      amount: request.amount,
      response,
    };
  }

  async redeem(vaultId: string, request: RedeemRequest): Promise<unknown> {
    if (!request.shareHoldingCid) {
      throw new Error("shareHoldingCid is required");
    }

    const vault = await this.findVaultContract(vaultId);
    const vaultAdmin = vault.payload?.id?.admin;
    const actAs = [request.party, vaultAdmin].filter(Boolean) as string[];

    const response = await this.ledger.exerciseChoice(
      VAULT_TEMPLATE,
      vault.contractId,
      "Redeem",
      {
        redeemer: request.party,
        sharesToRedeem: request.shares.toString(),
        receiver: request.receiver ?? request.party,
        shareHoldingCid: request.shareHoldingCid,
        redeemReason: request.reason ?? "user redeem",
      },
      actAs
    );

    return {
      status: "submitted",
      vaultId: vault.contractId,
      party: request.party,
      shares: request.shares,
      response,
    };
  }
}
