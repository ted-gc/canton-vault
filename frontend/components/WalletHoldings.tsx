"use client";

import { useEffect, useState } from "react";
import { getUnderlyingHoldings, type UnderlyingHolding } from "../lib/api";

interface WalletHoldingsProps {
  party: string | null;
  onRefresh?: () => void;
}

export default function WalletHoldings({ party, onRefresh }: WalletHoldingsProps) {
  const [holdings, setHoldings] = useState<UnderlyingHolding[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!party) {
      setHoldings([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getUnderlyingHoldings(party);
      setHoldings(data);
    } catch (err) {
      console.error("Failed to load wallet holdings:", err);
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [party]);

  // Listen for wallet refresh events
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("wallet:refresh", handler);
    return () => window.removeEventListener("wallet:refresh", handler);
  }, [party]);

  if (!party) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h4 className="text-sm font-semibold text-zinc-200">Your Wallet</h4>
        <p className="mt-2 text-sm text-zinc-500">Connect wallet to see your holdings</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-200">Your Wallet</h4>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          {loading ? "..." : "↻"}
        </button>
      </div>

      {holdings.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No underlying assets</p>
      ) : (
        <div className="mt-3 space-y-2">
          {holdings.map((h) => (
            <div
              key={h.contractId}
              className="flex items-center justify-between rounded-lg bg-zinc-950 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{h.instrument}</span>
                {h.locked && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                    Locked
                  </span>
                )}
              </div>
              <span className="text-sm text-zinc-300">{h.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
