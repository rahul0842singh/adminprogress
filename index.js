// server.js
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import walletRouter from "./routes/wallet.js";
import progressRouter from "./routes/progress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ==========================================
   CORS: allow ALL origins (credentials-safe)
   - Reflects any incoming Origin header (not "*")
   - Works with credentials (cookies/Authorization)
   ========================================== */
const corsOptions = {
  origin: (_origin, cb) => cb(null, true), // allow ALL origins
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
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

/* =========================
   Trust proxy (Render/CF)
   ========================= */
app.set("trust proxy", true);

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

/* =========================
   IP Logs (new)
   ========================= */
// Minimal Mongoose model (in-file) so you don't need another file
const IpLogSchema = new mongoose.Schema(
  {
    ip: { type: String, index: true },
    ua: { type: String },
    note: { type: String }, // optional client note
  },
  { timestamps: true }
);
const IpLog = mongoose.models.IpLog || mongoose.model("IpLog", IpLogSchema);

/** Helper to extract client IP behind proxies/CDNs */
function getClientIp(req) {
  // Cloudflare
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf);

  // X-Forwarded-For (may contain multiple, take first)
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0].split(",")[0].trim();
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();

  // Fallback
  return req.ip; // works with app.set('trust proxy', true)
}

/** POST /log-ip  -> stores { ip, ua, note? } */
app.post("/log-ip", async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const ua = req.get("user-agent") || "";
    const { note } = req.body || {};
    const doc = await IpLog.create({ ip, ua, note });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

/** GET /ip-logs?limit=50  -> most recent first */
app.get("/ip-logs", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 50));
    const logs = await IpLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json(logs);
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
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "server error" });
});

/* =========================
   Start
   ========================= */
const PORT = Number(process.env.PORT) || 8000;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log("CORS mode: ALLOW ALL ORIGINS (credentials enabled via reflection)");
  });
})();
