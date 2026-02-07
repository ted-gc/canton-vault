"use client";

import { useEffect, useState } from "react";
import { connect, getPrimaryAccount, getProvider } from "../lib/dapp-api";

export default function WalletConnect() {
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    getPrimaryAccount().then(setAccount).catch(() => null);
  }, []);

  const onConnect = async () => {
    setError(null);
    try {
      await connect();
      const acct = await getPrimaryAccount();
      setAccount(acct);
      window.dispatchEvent(new CustomEvent("wallet:connected", { detail: acct }));
    } catch (err: any) {
      setError(err?.message ?? "Failed to connect");
    }
  };

  return (
    <div className="flex items-center gap-3">
      {account ? (
        <div className="text-sm text-emerald-300">
          Connected: <span className="font-mono">{account}</span>
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
