import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import { connectDB } from "./db.js";
import progressRouter from "./routes/progress.js";
import ipLogRouter from "./routes/ipLog.js"; // <-- NEW

const app = express();

// Use real client IP when behind proxy/CDN
app.set("trust proxy", true);

// middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// routes
app.use("/progress", progressRouter);
app.use("/log-ip", ipLogRouter); // <-- POST /log-ip, GET /log-ip/recent

// 404
app.use((req, res) => {
  res.status(404).json({ error: "route not found" });
});

// central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "internal server error" });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`🚀 server listening on http://localhost:${PORT}`);
  });
})();
