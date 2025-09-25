import { Router } from "express";
import { Wallet } from "../models/Wallet.js";

const router = Router();

/**
 * GET /wallet
 * Fetch the current (singleton) wallet address
 */
router.get("/", async (req, res, next) => {
  try {
    const doc = await Wallet.findById("singleton").lean();
    if (!doc) return res.status(404).json({ error: "wallet address not set" });
    res.json({ address: doc.address, updatedAt: doc.updatedAt });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /wallet
 * Create/update the single wallet address
 * body: { "address": "..." }
 */
router.put("/", async (req, res, next) => {
  try {
    const { address } = req.body || {};
    if (typeof address !== "string" || address.trim().length < 10) {
      return res.status(400).json({ error: "invalid address" });
    }
    const updated = await Wallet.findByIdAndUpdate(
      "singleton",
      { address: address.trim() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ ok: true, address: updated.address, updatedAt: updated.updatedAt });
  } catch (err) {
    next(err);
  }
});

export default router;
