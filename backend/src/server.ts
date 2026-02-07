import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { LedgerClient } from "./ledger/client.js";
import { createVaultRouter } from "./api/vault.js";
import { createRegistryRouter } from "./api/registry.js";
import { VaultService } from "./services/vault.js";

const app = express();
app.use(cors());
app.use(express.json());

const ledger = new LedgerClient();
const vaultService = new VaultService(ledger);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(createRegistryRouter());
app.use(createVaultRouter(vaultService));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Canton Vault backend listening on :${port}`);
});
