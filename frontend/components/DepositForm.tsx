"use client";

import { useState, useEffect } from "react";
import { deposit } from "../lib/api";

interface DepositFormProps {
  vaultId: string;
  party: string | null;
  sharePrice: number;
  onComplete: () => void;
}

export default function DepositForm({ vaultId, party, sharePrice, onComplete }: DepositFormProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate preview shares
  const previewShares = amount && sharePrice > 0 
    ? (parseFloat(amount) / sharePrice).toFixed(4)
    : "0";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!party) {
      setError("Connect wallet first");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      const result = await deposit(vaultId, party, amount);
      setAmount("");
      setSuccess(`Deposited! Received ${previewShares} shares`);
      setTimeout(() => setSuccess(null), 3000);
      onComplete();
    } catch (err: any) {
      setError(err?.message ?? "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-200">Deposit Assets</h4>
        <span className="text-xs text-zinc-500">1 share = {sharePrice.toFixed(4)} assets</span>
      </div>
      
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-zinc-400">Amount to deposit</label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
        </div>
        
        <div className="flex items-center justify-between rounded-md bg-zinc-950 px-3 py-2">
          <span className="text-xs text-zinc-400">You&apos;ll receive</span>
          <span className="text-sm font-medium text-emerald-400">{previewShares} shares</span>
        </div>
        
        <button
          type="submit"
          disabled={loading || !party}
          className="w-full rounded-md bg-emerald-500/90 px-4 py-2.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing..." : !party ? "Connect Wallet" : "Deposit"}
        </button>
      </div>
      
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-3 text-xs text-emerald-400">{success}</p>}
    </form>
  );
}
