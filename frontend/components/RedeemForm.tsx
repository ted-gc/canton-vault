"use client";

import { useState } from "react";
import { redeem } from "../lib/api";

interface RedeemFormProps {
  vaultId: string;
  party: string | null;
  sharePrice: number;
  userShares: number;
  onComplete: () => void;
}

export default function RedeemForm({ vaultId, party, sharePrice, userShares, onComplete }: RedeemFormProps) {
  const [shares, setShares] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate preview assets
  const previewAssets = shares && sharePrice > 0
    ? (parseFloat(shares) * sharePrice).toFixed(4)
    : "0";

  const setMax = () => {
    setShares(userShares.toString());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!party) {
      setError("Connect wallet first");
      return;
    }
    const sharesNum = parseFloat(shares);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (sharesNum > userShares) {
      setError("Insufficient shares");
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      await redeem(vaultId, party, shares);
      setShares("");
      setSuccess(`Redeemed! Received ${previewAssets} assets`);
      setTimeout(() => setSuccess(null), 3000);
      onComplete();
    } catch (err: any) {
      setError(err?.message ?? "Redeem failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-200">Redeem Shares</h4>
        <span className="text-xs text-zinc-500">
          Balance: <span className="text-zinc-300">{userShares.toFixed(2)}</span>
        </span>
      </div>
      
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-zinc-400">Shares to redeem</label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min="0"
              max={userShares}
              step="any"
              placeholder="0.00"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={setMax}
              disabled={userShares <= 0}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between rounded-md bg-zinc-950 px-3 py-2">
          <span className="text-xs text-zinc-400">You&apos;ll receive</span>
          <span className="text-sm font-medium text-emerald-400">{previewAssets} assets</span>
        </div>
        
        <button
          type="submit"
          disabled={loading || !party || userShares <= 0}
          className="w-full rounded-md bg-emerald-500/90 px-4 py-2.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing..." : !party ? "Connect Wallet" : userShares <= 0 ? "No Shares" : "Redeem"}
        </button>
      </div>
      
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-3 text-xs text-emerald-400">{success}</p>}
    </form>
  );
}
