"use client";

import { useEffect, useState } from "react";
import { connect, getPrimaryAccount, getProvider } from "../lib/dapp-api";

export default function WalletConnect() {
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDemoInput, setShowDemoInput] = useState(false);
  const [demoParty, setDemoParty] = useState("alice");

  useEffect(() => {
    // Check for saved demo account
    const saved = localStorage.getItem("demo-party");
    if (saved) {
      setAccount(saved);
    } else {
      const provider = getProvider();
      if (provider) {
        getPrimaryAccount().then(setAccount).catch(() => null);
      }
    }
  }, []);

  const onConnect = async () => {
    setError(null);
    const provider = getProvider();
    
    if (!provider) {
      // No wallet - show demo mode
      setShowDemoInput(true);
      return;
    }

    try {
      await connect();
      const acct = await getPrimaryAccount();
      setAccount(acct);
      window.dispatchEvent(new CustomEvent("wallet:connected", { detail: acct }));
    } catch (err: any) {
      setError(err?.message ?? "Failed to connect");
    }
  };

  const onDemoConnect = () => {
    const party = demoParty.trim() || "alice";
    localStorage.setItem("demo-party", party);
    setAccount(party);
    setShowDemoInput(false);
    window.dispatchEvent(new CustomEvent("wallet:connected", { detail: party }));
  };

  const onDisconnect = () => {
    localStorage.removeItem("demo-party");
    setAccount(null);
    window.dispatchEvent(new CustomEvent("wallet:disconnected"));
  };

  if (showDemoInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={demoParty}
          onChange={(e) => setDemoParty(e.target.value)}
          placeholder="Party ID (e.g., alice)"
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          onKeyDown={(e) => e.key === "Enter" && onDemoConnect()}
          autoFocus
        />
        <button
          onClick={onDemoConnect}
          className="rounded-md bg-emerald-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-400"
        >
          Demo
        </button>
        <button
          onClick={() => setShowDemoInput(false)}
          className="rounded-md bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {account ? (
        <div className="flex items-center gap-2">
          <div className="text-sm text-emerald-300">
            <span className="font-mono">{account.length > 20 ? account.slice(0, 8) + "..." + account.slice(-6) : account}</span>
          </div>
          <button
            onClick={onDisconnect}
            className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-600 hover:text-white"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="rounded-md bg-emerald-500/90 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-400"
        >
          Connect Wallet
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
