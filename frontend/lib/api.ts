const BASE_URL = "http://localhost:3000";

export type Vault = {
  id: string;
  name: string;
  symbol: string;
  totalAssets: number;
  totalShares: number;
  sharePrice: number;
};

export type VaultDetail = Vault & {
  description?: string;
};

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

export async function getHoldings(id: string, party: string): Promise<{ shares: number; value: number }> {
  const res = await fetch(`${BASE_URL}/api/vaults/${id}/holdings/${party}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load holdings");
  return res.json();
}

export async function deposit(id: string, party: string, amount: string) {
  const res = await fetch(`${BASE_URL}/api/vaults/${id}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party, amount })
  });
  if (!res.ok) throw new Error("Deposit failed");
  return res.json();
}

export async function redeem(id: string, party: string, shares: string) {
  const res = await fetch(`${BASE_URL}/api/vaults/${id}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party, shares })
  });
  if (!res.ok) throw new Error("Redeem failed");
  return res.json();
}
