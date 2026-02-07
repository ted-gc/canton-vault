const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export type Vault = {
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
};

export type VaultDetail = Vault & {
  description?: string;
};

export type UnderlyingHolding = {
  contractId: string;
  instrument: string;
  amount: number;
  locked: boolean;
};

export type ShareHolding = {
  contractId: string;
  party: string;
  shares: number;
  value: number;
  locked: boolean;
};

// ===== Vaults =====

export async function getVaults(): Promise<Vault[]> {
  const res = await fetch(`${BASE_URL}/api/vaults`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load vaults");
  return res.json();
}

export async function getVault(id: string): Promise<VaultDetail> {
  const res = await fetch(`${BASE_URL}/api/vaults/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load vault");
  return res.json();
}

// ===== Holdings =====

export async function getShareHoldings(vaultId: string, party: string): Promise<ShareHolding> {
  const res = await fetch(`${BASE_URL}/api/vaults/${vaultId}/holdings/${party}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load holdings");
  return res.json();
}

export async function getUnderlyingHoldings(party: string, instrument?: string): Promise<UnderlyingHolding[]> {
  const params = new URLSearchParams();
  if (instrument) params.set("instrument", instrument);
  const url = `${BASE_URL}/api/underlying/${party}${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load underlying holdings");
  return res.json();
}

// Legacy alias
export const getHoldings = getShareHoldings;

// ===== Operations =====

export async function deposit(
  vaultId: string, 
  party: string, 
  amount: string,
  underlyingHoldingCid?: string
): Promise<{ status: string; shares: number; txId?: string }> {
  const res = await fetch(`${BASE_URL}/api/vaults/${vaultId}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party, amount, underlyingHoldingCid })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Deposit failed");
  }
  return res.json();
}

export async function redeem(
  vaultId: string, 
  party: string, 
  shares: string,
  shareHoldingCid?: string
): Promise<{ status: string; assets: number; txId?: string }> {
  const res = await fetch(`${BASE_URL}/api/vaults/${vaultId}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party, shares, shareHoldingCid })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Redeem failed");
  }
  return res.json();
}
