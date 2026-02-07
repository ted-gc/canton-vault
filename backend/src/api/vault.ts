import { Router, Request, Response } from "express";
import { VaultService } from "../services/vault.js";

export function createVaultRouter(service: VaultService): Router {
  const router = Router();

  router.get("/api/vaults", async (_req: Request, res: Response) => {
    try {
      const vaults = await service.listVaults();
      res.json(vaults);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Vault lookup failed" });
    }
  });

  router.get("/api/vaults/:id", async (req: Request, res: Response) => {
    try {
      const vault = await service.getVault(req.params.id);
      if (!vault) return res.status(404).json({ error: "Vault not found" });
      res.json(vault);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Vault lookup failed" });
    }
  });

  router.post("/api/vaults/:id/deposit", async (req: Request, res: Response) => {
    try {
      const { party, amount, underlyingHoldingCid, receiver, reason } = req.body ?? {};
      if (!party || typeof amount !== "number" || !underlyingHoldingCid) {
        return res
          .status(400)
          .json({ error: "party, amount, and underlyingHoldingCid are required" });
      }
      const result = await service.deposit(req.params.id, {
        party,
        amount,
        underlyingHoldingCid,
        receiver,
        reason,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Deposit failed" });
    }
  });

  router.post("/api/vaults/:id/redeem", async (req: Request, res: Response) => {
    try {
      const { party, shares, shareHoldingCid, receiver, reason } = req.body ?? {};
      if (!party || typeof shares !== "number" || !shareHoldingCid) {
        return res
          .status(400)
          .json({ error: "party, shares, and shareHoldingCid are required" });
      }
      const result = await service.redeem(req.params.id, {
        party,
        shares,
        shareHoldingCid,
        receiver,
        reason,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Redeem failed" });
    }
  });

  router.get("/api/vaults/:id/holdings/:party", async (req: Request, res: Response) => {
    try {
      const result = await service.getHoldings(req.params.id, req.params.party);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Holdings lookup failed" });
    }
  });

  return router;
}
