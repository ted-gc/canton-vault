import { Router, Request, Response } from "express";
import { VaultService } from "../services/vault.js";

export function createVaultRouter(service: VaultService): Router {
  const router = Router();

  router.get("/api/vaults", (_req: Request, res: Response) => {
    res.json(service.listVaults());
  });

  router.get("/api/vaults/:id", (req: Request, res: Response) => {
    const vault = service.getVault(req.params.id);
    if (!vault) return res.status(404).json({ error: "Vault not found" });
    res.json(vault);
  });

  router.post("/api/vaults/:id/deposit", async (req: Request, res: Response) => {
    try {
      const { party, amount } = req.body ?? {};
      if (!party || typeof amount !== "number") {
        return res.status(400).json({ error: "party and amount are required" });
      }
      const result = await service.deposit(req.params.id, { party, amount });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Deposit failed" });
    }
  });

  router.post("/api/vaults/:id/redeem", async (req: Request, res: Response) => {
    try {
      const { party, shares } = req.body ?? {};
      if (!party || typeof shares !== "number") {
        return res.status(400).json({ error: "party and shares are required" });
      }
      const result = await service.redeem(req.params.id, { party, shares });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Redeem failed" });
    }
  });

  router.get("/api/vaults/:id/holdings/:party", (req: Request, res: Response) => {
    try {
      const result = service.getHoldings(req.params.id, req.params.party);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Holdings lookup failed" });
    }
  });

  return router;
}
