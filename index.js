// server.js
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import walletRouter from "./routes/wallet.js";

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
    "https://cr7officialsol.com", // ← added as requested
  ];

  // unique list
  const set = new Set([...fromList, single, ...defaults].filter(Boolean));
  return Array.from(set);
}

const ALLOWED_ORIGINS = envOrigins();

const corsOptions = {
  origin(origin, cb) {
    // allow non-browser requests (no Origin) like curl/Postman
    if (!origin) return cb(null, true);

    const incoming = normalizeOrigin(origin);
    const allowed = ALLOWED_ORIGINS.map(normalizeOrigin);
    const isAllowed = allowed.includes(incoming);

    if (isAllowed) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Ensure caches/proxies vary on Origin
app.use((req, res, next) => {
  res.header("Vary", "Origin");
  next();
});

app.use(cors(corsOptions));
// preflight for everything
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
   Health
   ========================= */
app.get("/_health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/* =========================
   Routes
   ========================= */
app.use("/wallet", walletRouter);

/* =========================
   404
   ========================= */
app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

/* =========================
   Error handler
   ========================= */
app.use((err, req, res, next) => {
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
    console.log(`CORS allowlist:`, ALLOWED_ORIGINS);
  });
})();
