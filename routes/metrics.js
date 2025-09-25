// routes/metrics.js
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

/** Schema to count clicks per order (and optionally by session/IP) */
const PaymentClickSchema = new mongoose.Schema(
  {
    orderId: { type: String, index: true },
    currency: String,
    amount: String,
    address: String,

    // aggregate counters
    clicks: { type: Number, default: 0 },

    // optional details
    sessionId: { type: String },
    ip: { type: String },
    ua: { type: String },
    meta: { type: Object },

    firstAt: Date,
    lastAt: Date
  },
  { timestamps: true }
);

// helpful compound index if you want to split by order+session
PaymentClickSchema.index({ orderId: 1, sessionId: 1 });

const PaymentClick = mongoose.models.PaymentClick
  || mongoose.model("PaymentClick", PaymentClickSchema);

// utility to read client IP behind proxies
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf);
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0].split(",")[0].trim();
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.ip;
}

/**
 * POST /metrics/payment-click
 * Body: { orderId, amount, currency, address, sessionId?, meta? }
 * Increments clicks for (orderId, sessionId) or just (orderId) if sessionId not provided.
 */
router.post("/payment-click", async (req, res, next) => {
  try {
    const {
      orderId = "",
      amount = "",
      currency = "",
      address = "",
      sessionId = "",       // pass a random per-tab id if you want per-session stats
      meta = {}             // you can send any small extra info
    } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ error: "orderId required" });
    }

    const ip = clientIp(req);
    const ua = req.get("user-agent") || "";

    const now = new Date();
    const filter = sessionId ? { orderId, sessionId } : { orderId };
    const update = {
      $inc: { clicks: 1 },
      $set: {
        currency,
        amount,
        address,
        ip,
        ua,
        lastAt: now,
      },
      $setOnInsert: {
        firstAt: now,
        meta
      }
    };

    const doc = await PaymentClick.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true
    });

    res.status(201).json({ ok: true, clicks: doc.clicks });
  } catch (err) {
    next(err);
  }
});

/** Optional: GET totals for an order */
router.get("/payment-clicks", async (req, res, next) => {
  try {
    const { orderId } = req.query || {};
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const rows = await PaymentClick.find({ orderId }).lean();
    const total = rows.reduce((sum, r) => sum + (Number(r.clicks) || 0), 0);
    res.json({ orderId, total, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
