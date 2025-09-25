// server.js
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import metricsRouter from "./routes/metrics.js";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import walletRouter from "./routes/wallet.js";
import progressRouter from "./routes/progress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ==========================================
   CORS: allow ALL origins (credentials-safe)
   ========================================== */
const corsOptions = {
  origin: (_origin, cb) => cb(null, true), // allow ALL
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =========================
   Core middleware
   ========================= */
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.set("trust proxy", true); // real client IP behind CF/Render

/* =========================
   Static (optional)
   ========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   Health + root
   ========================= */
app.get("/_health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/", (_req, res) => res.json({ ok: true, message: "CR7 API up" }));

/* =========================
   Routers
   ========================= */
app.use("/wallet", walletRouter);
app.use("/progress", progressRouter);
app.use("/metrics", metricsRouter);   

/* =========================
   IP Logs (compact + indexed)
   ========================= */
const IpLogSchema = new mongoose.Schema(
  {
    ip: { type: String, index: true },   // server-detected IP
    ua: { type: String },                // user-agent
    note: { type: String },              // optional note from client
    page: { type: String },              // optional page path
  },
  { timestamps: true }
);
// fast recent queries
IpLogSchema.index({ createdAt: -1 });

const IpLog = mongoose.models.IpLog || mongoose.model("IpLog", IpLogSchema);

function getClientIp(req) {
  // Prefer CF if present
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf);
  // XFF may contain multiple; first is original client
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0].split(",")[0].trim();
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  // Fallback (works with trust proxy)
  return req.ip;
}

/** POST /log-ip  Body: { note?, page? } */
app.post("/log-ip", async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const ua = req.get("user-agent") || "";
    const { note = "", page = "" } = req.body || {};

    const doc = await IpLog.create({
      ip,
      ua,
      note: String(note).slice(0, 200),
      page: String(page).slice(0, 200),
    });

    // return minimal ack to reduce payload
    res.status(201).json({ _id: doc._id, createdAt: doc.createdAt });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /log-ip/recent?limit=1000&after=<ISO date>
 * Returns newest first. Compact payload { count, rows }.
 */
app.get("/log-ip/recent", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const after = req.query.after; // optional cursor (ISO date)

    const filter = {};
    if (after) {
      const dt = new Date(String(after));
      if (!isNaN(dt.getTime())) {
        filter.createdAt = { $lt: dt };
      }
    }

    // Only fields the UI typically needs to list
    const projection = { _id: 1, createdAt: 1, ip: 1, page: 1 };
    const rows = await IpLog.find(filter, projection)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

/** Aliases to match other callers */
app.get("/log-ip", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const projection = { _id: 1, createdAt: 1, ip: 1, page: 1 };
    const rows = await IpLog.find({}, projection).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});
app.get("/ip-logs", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const projection = { _id: 1, createdAt: 1, ip: 1, page: 1 };
    const rows = await IpLog.find({}, projection).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

/* =========================
   404
   ========================= */
app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

/* =========================
   Error handler
   ========================= */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "server error" });
});

/* =========================
   Start
   ========================= */
const PORT = Number(process.env.PORT) || 8000;
(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log("CORS: allow all; compression on; /wallet, /progress, /log-ip ready");
  });
})();
