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
   CORS allowlist (by hostname)
   ========================= */
function normalize(str) {
  return (str || "").trim().replace(/\/+$/, "");
}
function parseHostname(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return ""; // non-URL/undefined -> treat as no origin (curl/Postman)
  }
}

// Allow injecting full origins or hostnames via env
const envOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(normalize)
  .filter(Boolean);

const envSingle = normalize(process.env.FRONTEND_ORIGIN);

// Build allowlists
const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://cr7officialsol.com",
  "https://cr7react.vercel.app", // explicitly allowed origin
];

const allowedOrigins = Array.from(
  new Set([...defaultOrigins, envSingle, ...envOrigins].filter(Boolean))
);

// Derive hostnames to allow (scheme/port agnostic)
const allowedHostnames = new Set(
  allowedOrigins
    .map((o) => parseHostname(o) || o.toLowerCase())
    .concat([
      // hostnames only (scheme-agnostic) for local/dev
      "localhost",
      "127.0.0.1",
      // explicit production hosts
      "cr7officialsol.com",
      "cr7react.vercel.app",
    ])
);

const corsOptions = {
  origin(origin, cb) {
    // No origin header (curl/Postman/same-origin SSR) -> allow
    if (!origin) return cb(null, true);

    const incomingOrigin = normalize(origin);
    const incomingHost = parseHostname(incomingOrigin);

    const originAllowed =
      allowedOrigins.includes(incomingOrigin) ||
      (incomingHost && allowedHostnames.has(incomingHost));

    if (originAllowed) return cb(null, true);

    // Log what was rejected to help debugging
    console.warn(
      `[CORS] Rejected origin: ${incomingOrigin} (host: ${incomingHost}) | allowlist:`,
      { allowedOrigins, allowedHostnames: Array.from(allowedHostnames) }
    );
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
   Start
   ========================= */
const PORT = Number(process.env.PORT) || 8000;

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

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`CORS full-origin allowlist:`, allowedOrigins);
    console.log(`CORS hostname allowlist:`, Array.from(allowedHostnames));
    listRoutes();
  });
})();
