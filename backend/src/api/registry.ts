import { Router, Request, Response } from "express";

export function createRegistryRouter(): Router {
  const router = Router();

  router.get("/registry/v1/metadata", (_req: Request, res: Response) => {
    res.json({
      name: "Canton Vault Registry",
      version: "1.0.0",
      endpoints: {
        transferFactory: "/registry/transfer-instruction-v1/transfer-factory",
      },
      patterns: [
        "Holdings",
        "TransferInstruction",
        "TransferFactory",
      ],
    });
  });

  router.post(
    "/registry/transfer-instruction-v1/transfer-factory",
    (req: Request, res: Response) => {
      // This is a simplified stub for CIP-0056 transfer-factory.
      // In a full implementation, you would create/submit a TransferFactory contract.
      const { sender, receiver, amount, assetId } = req.body ?? {};

      if (!sender || !receiver || typeof amount !== "number") {
        return res.status(400).json({ error: "sender, receiver, amount required" });
      }

      res.json({
        status: "accepted",
        sender,
        receiver,
        amount,
        assetId: assetId ?? null,
        transferFactoryId: `tf-${Date.now()}`,
      });
    }
  );

  return router;
}
