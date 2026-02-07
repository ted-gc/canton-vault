"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WalletConnect from "../../../components/WalletConnect";
import DepositForm from "../../../components/DepositForm";
import RedeemForm from "../../../components/RedeemForm";
import { getPrimaryAccount } from "../../../lib/dapp-api";
import { getHoldings, getVault, type VaultDetail } from "../../../lib/api";

export default function VaultDetailPage({ params }: { params: { id: string } }) {
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [party, setParty] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<{ shares: number; value: number } | null>(null);
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
        const h = await getHoldings(params.id, acct);
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
          <p className="text-sm text-zinc-400">{vault.symbol}</p>
        </div>
        <WalletConnect />
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Total Assets</div>
          <div className="text-lg font-semibold">{vault.totalAssets}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Total Shares</div>
          <div className="text-lg font-semibold">{vault.totalShares}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">Share Price</div>
          <div className="text-lg font-semibold">{vault.sharePrice}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">APY</div>
          <div className="text-lg font-semibold">—</div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <DepositForm vaultId={vault.id} party={party} onComplete={onRefresh} />
        <RedeemForm vaultId={vault.id} party={party} onComplete={onRefresh} />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="text-sm text-zinc-300">Your Holdings</div>
        {party ? (
          <div className="mt-2 grid gap-2 text-sm">
            <div>
              <span className="text-zinc-400">Shares:</span> {holdings?.shares ?? 0}
            </div>
            <div>
              <span className="text-zinc-400">Value:</span> {holdings?.value ?? 0} {vault.symbol}
            </div>
            <div className="text-xs text-zinc-500">Party: {party}</div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-zinc-400">Connect wallet to see your balance.</div>
        )}
      </section>
    </main>
  );
}
