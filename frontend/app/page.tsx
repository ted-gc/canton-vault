import VaultCard from "../components/VaultCard";
import WalletConnect from "../components/WalletConnect";
import { getVaults } from "../lib/api";

export default async function HomePage() {
  const vaults = await getVaults();

  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Canton Vault</h1>
          <p className="text-sm text-zinc-400">Secure yield vaults on Canton</p>
        </div>
        <WalletConnect />
      </header>

      <section className="grid gap-4">
        {vaults.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </section>
    </main>
  );
}
