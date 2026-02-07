import { LedgerClient } from "../ledger/client.js";

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
}

export interface RedeemRequest {
  party: string;
  shares: number;
}

const defaultVaults: VaultSummary[] = [
  {
    id: "vault-1",
    name: "Canton USD Vault",
    totalAssets: 1_000_000,
    totalShares: 1_000_000,
    sharePrice: 1.0,
  },
];

// Simple in-memory holdings cache for demo purposes.
const holdings: Record<string, Record<string, number>> = {
  "vault-1": {
    "party-1": 1000,
  },
};

export class VaultService {
  constructor(private ledger: LedgerClient) {}

  listVaults(): VaultSummary[] {
    return defaultVaults;
  }

  getVault(id: string): VaultSummary | undefined {
    return defaultVaults.find((v) => v.id === id);
  }

  getHoldings(vaultId: string, party: string): VaultHolding {
    const shares = holdings[vaultId]?.[party] ?? 0;
    return { party, shares };
  }

  async deposit(vaultId: string, request: DepositRequest): Promise<unknown> {
    const vault = this.getVault(vaultId);
    if (!vault) throw new Error("Vault not found");

    // Update simple cache
    holdings[vaultId] = holdings[vaultId] ?? {};
    holdings[vaultId][request.party] = (holdings[vaultId][request.party] ?? 0) + request.amount;

    // Optional ledger submission (kept generic)
    if (process.env.LEDGER_SUBMIT === "true") {
      await this.ledger.submitCommand({
        party: request.party,
        action: "Deposit",
        vaultId,
        amount: request.amount,
      });
    }

    return {
      status: "accepted",
      vaultId,
      party: request.party,
      amount: request.amount,
    };
  }

  async redeem(vaultId: string, request: RedeemRequest): Promise<unknown> {
    const vault = this.getVault(vaultId);
    if (!vault) throw new Error("Vault not found");

    holdings[vaultId] = holdings[vaultId] ?? {};
    holdings[vaultId][request.party] = Math.max(
      0,
      (holdings[vaultId][request.party] ?? 0) - request.shares
    );

    if (process.env.LEDGER_SUBMIT === "true") {
      await this.ledger.submitCommand({
        party: request.party,
        action: "Redeem",
        vaultId,
        shares: request.shares,
      });
    }

    return {
      status: "accepted",
      vaultId,
      party: request.party,
      shares: request.shares,
    };
  }
}
