// server.js
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import walletRouter from "./routes/wallet.js";
import progressRouter from "./routes/progress.js"; // <-- ADD THIS

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* =========================
   CORS allowlist (normalized)
   ========================= */
function normalizeOrigin(o) {
  if (!o) return "";
  return String(o).trim().replace(/\/+$/, ""); // trim + remove trailing slash(es)
}

function envOrigins() {
  // FRONTEND_ORIGINS supports comma-separated list
  const fromList = (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  const single = normalizeOrigin(process.env.FRONTEND_ORIGIN);

  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://cr7officialsol.com",
  ];

  const set = new Set([...fromList, single, ...defaults].filter(Boolean));
  return Array.from(set);
}

const ALLOWED_ORIGINS = envOrigins();

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/Postman or same-origin
    const incoming = normalizeOrigin(origin);
    const allowed = ALLOWED_ORIGINS.map(normalizeOrigin);
    if (allowed.includes(incoming)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Vary: Origin for caches/proxies
app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

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
   Health
   ========================= */
app.get("/_health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/* =========================
   Routes
   ========================= */
app.use("/wallet", walletRouter);
app.use("/progress", progressRouter); // <-- MOUNT HERE

/* =========================
   404
   ========================= */
app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

/* =========================
   Error handler
   ========================= */
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
    console.log(`CORS allowlist:`, ALLOWED_ORIGINS);
  });
})();
