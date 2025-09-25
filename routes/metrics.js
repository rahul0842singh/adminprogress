import { Router } from "express";
import PaymentClick from "../models/PaymentClick.js";

const router = Router();

/**
 * POST /metrics/payment-click
 * Body: { orderId, amount, currency, address, sessionId, meta }
 */
router.post("/payment-click", async (req, res, next) => {
  try {
    const doc = await PaymentClick.create({
      orderId: String(req.body?.orderId || ""),
      amount: String(req.body?.amount || ""),
      currency: String(req.body?.currency || ""),
      address: String(req.body?.address || ""),
      sessionId: String(req.body?.sessionId || ""),
      meta: req.body?.meta || {},
    });
    // Created
    res.status(201).json({ ok: true, id: doc._id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /metrics/payment-click/stats
 * Returns: total, last24h, byDay [{ day: 'YYYY-MM-DD', count }]
 * Optional query: ?days=7 (default 14)
 */
router.get("/payment-click/stats", async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 14));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, last24h, byDay] = await Promise.all([
      PaymentClick.countDocuments({}),
      PaymentClick.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      PaymentClick.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { date: "$createdAt", format: "%Y-%m-%d" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: { _id: 0, day: "$_id", count: 1 },
        },
      ]),
    ]);

    res.json({ total, last24h, byDay, windowDays: days });
  } catch (err) {
    next(err);
  }
});

/**
 * (Optional) GET /metrics/payment-click
 * Paginated raw rows for debugging: ?limit=50
 */
router.get("/payment-click", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const rows = await PaymentClick.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
