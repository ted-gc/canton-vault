"use client";

import { useState, useEffect } from "react";
import { deposit, getUnderlyingHoldings, type UnderlyingHolding } from "../lib/api";

interface DepositFormProps {
  vaultId: string;
  party: string | null;
  sharePrice: number;
  underlyingAsset: string;
  minDeposit: number;
  onComplete: () => void;
}

export default function DepositForm({ 
  vaultId, 
  party, 
  sharePrice, 
  underlyingAsset,
  minDeposit,
  onComplete 
}: DepositFormProps) {
  const [holdings, setHoldings] = useState<UnderlyingHolding[]>([]);
  const [selectedHolding, setSelectedHolding] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load available holdings for this asset type
  useEffect(() => {
    if (!party) {
      setHoldings([]);
      return;
    }
    getUnderlyingHoldings(party, underlyingAsset)
      .then((data) => {
        const available = data.filter((h) => !h.locked);
        setHoldings(available);
        if (available.length > 0 && !selectedHolding) {
          setSelectedHolding(available[0].contractId);
        }
      })
      .catch(() => setHoldings([]));
  }, [party, underlyingAsset]);

  // Get selected holding details
  const selected = holdings.find((h) => h.contractId === selectedHolding);
  const maxAmount = selected?.amount ?? 0;

  // Calculate preview shares
  const amountNum = parseFloat(amount) || 0;
  const previewShares = sharePrice > 0 ? (amountNum / sharePrice).toFixed(4) : "0";

  const setMax = () => {
    if (selected) {
      setAmount(selected.amount.toString());
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!party) {
      setError("Connect wallet first");
      return;
    }
    if (!selectedHolding) {
      setError(`No ${underlyingAsset} holdings available`);
      return;
    }
    if (amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amountNum < minDeposit) {
      setError(`Minimum deposit is ${minDeposit} ${underlyingAsset}`);
      return;
    }
    if (amountNum > maxAmount) {
      setError("Insufficient balance");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await deposit(vaultId, party, amount, selectedHolding);
      setAmount("");
      setSuccess(`Deposited ${amountNum} ${underlyingAsset} → ${result.shares.toFixed(4)} shares`);
      setTimeout(() => setSuccess(null), 4000);
      // Refresh wallet holdings
      window.dispatchEvent(new CustomEvent("wallet:refresh"));
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
        <h4 className="text-sm font-semibold text-zinc-200">Deposit {underlyingAsset}</h4>
        <span className="text-xs text-zinc-500">Min: {minDeposit}</span>
      </div>

      <div className="mt-4 space-y-3">
        {/* Holding selector */}
        {holdings.length > 1 && (
          <div>
            <label className="text-xs text-zinc-400">Select holding</label>
            <select
              value={selectedHolding}
              onChange={(e) => setSelectedHolding(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              {holdings.map((h) => (
                <option key={h.contractId} value={h.contractId}>
                  {h.amount.toLocaleString()} {h.instrument}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Available balance */}
        {selected && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Available</span>
            <span className="text-zinc-300">{maxAmount.toLocaleString()} {underlyingAsset}</span>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="text-xs text-zinc-400">Amount to deposit</label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min="0"
              max={maxAmount}
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={setMax}
              disabled={maxAmount <= 0}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center justify-between rounded-md bg-zinc-950 px-3 py-2">
          <span className="text-xs text-zinc-400">You&apos;ll receive</span>
          <span className="text-sm font-medium text-emerald-400">{previewShares} shares</span>
        </div>

        {/* No holdings warning */}
        {party && holdings.length === 0 && (
          <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            No {underlyingAsset} holdings available to deposit
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !party || holdings.length === 0}
          className="w-full rounded-md bg-emerald-500/90 px-4 py-2.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing..." : !party ? "Connect Wallet" : holdings.length === 0 ? `No ${underlyingAsset}` : "Deposit"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-3 text-xs text-emerald-400">{success}</p>}
    </form>
  );
}
