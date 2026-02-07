"use client";

import { useState } from "react";
import { deposit } from "../lib/api";

export default function DepositForm({ vaultId, party, onComplete }: { vaultId: string; party: string | null; onComplete: () => void }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!party) {
      setError("Connect a wallet first");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await deposit(vaultId, party, amount);
      setAmount("");
      onComplete();
    } catch (err: any) {
      setError(err?.message ?? "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h4 className="text-sm font-semibold text-zinc-200">Deposit Assets</h4>
      <div className="mt-3 flex gap-3">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? "Depositing..." : "Deposit"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}
