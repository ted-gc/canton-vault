"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WalletConnect from "../../../components/WalletConnect";
import WalletHoldings from "../../../components/WalletHoldings";
import DepositForm from "../../../components/DepositForm";
import RedeemForm from "../../../components/RedeemForm";
import { getPrimaryAccount } from "../../../lib/dapp-api";
import { getShareHoldings, getVault, type Vault, type ShareHolding } from "../../../lib/api";

export default function VaultDetailPage({ params }: { params: { id: string } }) {
  const [vault, setVault] = useState<Vault | null>(null);
  const [party, setParty] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<ShareHolding | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (accountOverride?: string | null) => {
    try {
      const data = await getVault(params.id);
      setVault(data);
      // Check for demo party in localStorage, then real wallet
      const demoParty = localStorage.getItem("demo-party");
      const acct = accountOverride ?? demoParty ?? (await getPrimaryAccount().catch(() => null));
      setParty(acct);
      if (acct) {
        const h = await getShareHoldings(params.id, acct);
        setHoldings(h);
      } else {
        setHoldings(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load vault");
    }
  };

  useEffect(() => {
    load();
    const connectHandler = (event: Event) => {
      const acct = (event as CustomEvent<string>).detail;
      load(acct);
    };
    const disconnectHandler = () => {
      setParty(null);
      setHoldings(null);
    };
    window.addEventListener("wallet:connected", connectHandler as EventListener);
    window.addEventListener("wallet:disconnected", disconnectHandler);
    return () => {
      window.removeEventListener("wallet:connected", connectHandler as EventListener);
      window.removeEventListener("wallet:disconnected", disconnectHandler);
    };
  }, [params.id]);

  const onRefresh = async () => {
    await load(party);
    // Also refresh wallet holdings
    window.dispatchEvent(new CustomEvent("wallet:refresh"));
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-emerald-300">← Back</Link>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!vault) {
    return <div className="text-sm text-zinc-400">Loading...</div>;
  }

  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-emerald-300">← Back</Link>
          <h1 className="mt-2 text-2xl font-semibold">{vault.name}</h1>
          <p className="text-sm text-zinc-400">{vault.symbol} • Accepts {vault.underlyingAsset}</p>
        </div>
        <WalletConnect />
      </header>

      {/* Vault Stats */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Total Assets ({vault.underlyingAsset})</div>
          <div className="text-lg font-semibold">{vault.totalAssets.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Total Shares</div>
          <div className="text-lg font-semibold">{vault.totalShares.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Share Price</div>
          <div className="text-lg font-semibold">{vault.sharePrice.toFixed(4)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Deposit Limit</div>
          <div className="text-lg font-semibold">
            {vault.depositLimit ? vault.depositLimit.toLocaleString() : "Unlimited"}
          </div>
        </div>
      </section>

      {/* Wallet Holdings */}
      <WalletHoldings party={party} />

      {/* Your Vault Position */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="text-sm font-semibold text-zinc-200">Your Vault Position</div>
        {party ? (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-zinc-950 px-4 py-3">
              <div className="text-xs text-zinc-400">Shares</div>
              <div className="text-lg font-semibold">{(holdings?.shares ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-zinc-950 px-4 py-3">
              <div className="text-xs text-zinc-400">Value ({vault.underlyingAsset})</div>
              <div className="text-lg font-semibold">{(holdings?.value ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-lg bg-zinc-950 px-4 py-3">
              <div className="text-xs text-zinc-400">Status</div>
              <div className="text-lg font-semibold">
                {holdings?.locked ? (
                  <span className="text-amber-400">Locked</span>
                ) : (
                  <span className="text-emerald-400">Available</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Connect wallet to see your position</p>
        )}
      </section>

      {/* Deposit / Redeem */}
      <section className="grid gap-4 md:grid-cols-2">
        <DepositForm 
          vaultId={vault.id} 
          party={party} 
          sharePrice={vault.sharePrice}
          underlyingAsset={vault.underlyingAsset}
          minDeposit={vault.minDeposit}
          onComplete={onRefresh} 
        />
        <RedeemForm 
          vaultId={vault.id} 
          party={party} 
          sharePrice={vault.sharePrice}
          userShares={holdings?.shares ?? 0}
          onComplete={onRefresh} 
        />
      </section>
    </main>
  );
}
