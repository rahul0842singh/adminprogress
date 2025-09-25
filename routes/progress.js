// index.js
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
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
  credentials: true,                        // allow cookies/Authorization
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Ensure caches/proxies vary responses by Origin
app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});
app.use(cors(corsOptions));
// Preflight for everything
app.options("*", cors(corsOptions));

/* =========================
   Core middleware
   ========================= */
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

/* =========================
   Static (optional)
   ========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   Health + root
   ========================= */
app.get("/_health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/", (req, res) => res.json({ ok: true, message: "CR7 API up" }));

/* =========================
   Routes
   ========================= */
app.use("/wallet", walletRouter);
app.use("/progress", progressRouter);

/* =========================
   404 + error handler
   ========================= */
app.use((req, res) => res.status(404).json({ error: "not found" }));
app.use((err, req, res, _next) => {
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
    console.log("CORS mode: ALLOW ALL ORIGINS (credentials enabled via reflection)");
  });
})();
