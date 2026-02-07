import Link from "next/link";
import type { Vault } from "../lib/api";

export default function VaultCard({ vault }: { vault: Vault }) {
  return (
    <Link
      href={`/vault/${vault.id}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-emerald-500/60"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{vault.name}</h3>
          <p className="text-sm text-zinc-400">{vault.symbol}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-400">Share Price</div>
          <div className="text-sm font-medium">{vault.sharePrice}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs text-zinc-400">Total Assets</div>
          <div className="font-medium">{vault.totalAssets}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Total Shares</div>
          <div className="font-medium">{vault.totalShares}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-400">APY</div>
          <div className="font-medium">—</div>
        </div>
      </div>
    </Link>
  );
}
