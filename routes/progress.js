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
    "https://cr7react.vercel.app", // <-- added
  ];

  return Array.from(new Set([...fromList, single, ...defaults].filter(Boolean)));
}
const ALLOWED_ORIGINS = envOrigins();

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/Postman or same-origin
    const incoming = normalizeOrigin(origin);
    if (ALLOWED_ORIGINS.map(normalizeOrigin).includes(incoming)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

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
   Health + root
   ========================= */
app.get("/_health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/", (req, res) => res.json({ ok: true, message: "CR7 API up" }));

/* =========================
   Routes
   ========================= */
app.use("/wallet", walletRouter);
app.use("/progress", progressRouter);

// Quick debug endpoint to confirm router is mounted
app.get("/progress/debug", (_req, res) => {
  res.json({ ok: true, note: "Progress router mounted" });
});

/* =========================
   404 + error handler
   ========================= */
app.use((req, res) => res.status(404).json({ error: "not found" }));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "server error" });
});

/* =========================
   Route listing (logs)
   ========================= */
function listRoutes() {
  const routes = [];
  app._router.stack.forEach((layer) => {
    if (layer.route?.path) {
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
      routes.push({ path: layer.route.path, methods });
    } else if (layer.name === "router" && layer.handle?.stack) {
      const mount = layer.regexp?.toString?.() || "";
      const m = mount.match(/\\\/([^\\^/?]+)\\\//);
      const mountPath = m ? `/${m[1]}` : "(mounted)";
      layer.handle.stack.forEach((s) => {
        if (s.route?.path) {
          const methods = Object.keys(s.route.methods).map((x) => x.toUpperCase());
          routes.push({ path: `${mountPath}${s.route.path}`, methods });
        }
      });
    }
  });
  console.log("Registered routes:", routes);
}

/* =========================
   Start
   ========================= */
const PORT = Number(process.env.PORT) || 8000;
(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`CORS allowlist:`, ALLOWED_ORIGINS);
    listRoutes();
  });
})();
