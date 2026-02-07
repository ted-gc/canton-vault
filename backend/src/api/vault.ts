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
      // Support string or number for amount
      const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
      if (!party || typeof numAmount !== "number" || isNaN(numAmount)) {
        return res.status(400).json({ error: "party and amount are required" });
      }
      const result = await service.deposit(req.params.id, {
        party,
        amount: numAmount,
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
      // Support string or number for shares
      const numShares = typeof shares === "string" ? parseFloat(shares) : shares;
      if (!party || typeof numShares !== "number" || isNaN(numShares)) {
        return res.status(400).json({ error: "party and shares are required" });
      }
      const result = await service.redeem(req.params.id, {
        party,
        shares: numShares,
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

  // ===== Underlying Holdings =====

  router.get("/api/underlying/:party", async (req: Request, res: Response) => {
    try {
      const { instrument } = req.query;
      const result = await service.getUnderlyingHoldings(
        req.params.party,
        typeof instrument === "string" ? instrument : undefined
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Underlying lookup failed" });
    }
  });

  return router;
}
