// routes/ipLog.js
import { Router } from "express";
import axios from "axios";
import IpLog from "../models/IpLog.js";

const router = Router();

const IPINFO_TOKEN = process.env.IPINFO_TOKEN || "";

/* util: pick real client IP (trust proxy is set in server.js) */
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf);
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0].split(",")[0].trim();
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.ip;
}

/* optional geolocation lookups (timeouts kept tight) */
async function geolocateIp(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return null;

  if (IPINFO_TOKEN) {
    try {
      const r = await axios.get(`https://ipinfo.io/${encodeURIComponent(ip)}`, {
        params: { token: IPINFO_TOKEN },
        timeout: 3500,
      });
      const loc = (r.data.loc || "").split(",");
      const latitude = loc.length === 2 ? Number(loc[0]) : undefined;
      const longitude = loc.length === 2 ? Number(loc[1]) : undefined;
      return {
        ip: r.data.ip || ip,
        city: r.data.city || undefined,
        region: r.data.region || undefined,
        country: r.data.country || undefined,
        latitude,
        longitude,
        asn: r.data.org?.split(" ")[0],
        org: r.data.org || undefined,
        timezone: r.data.timezone || undefined,
      };
    } catch { /* fall through */ }
  }

  try {
    const r = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      timeout: 3500,
    });
    return {
      ip: r.data.ip || ip,
      city: r.data.city || undefined,
      region: r.data.region || r.data.region_code || undefined,
      country: r.data.country_name || r.data.country || undefined,
      latitude: r.data.latitude != null ? Number(r.data.latitude) : undefined,
      longitude: r.data.longitude != null ? Number(r.data.longitude) : undefined,
      asn: r.data.asn || undefined,
      org: r.data.org || r.data.org_name || undefined,
      timezone: r.data.timezone || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * POST /log-ip
 * Body: { ipFromClient?: string, userAgent?: string, page?: string, note?: string }
 */
router.post("/", async (req, res, next) => {
  try {
    const serverIp = clientIp(req);
    const {
      ipFromClient = "",
      userAgent = req.get("user-agent") || "",
      page = "",
      note = "",
    } = req.body || {};

    const ipForGeo = ipFromClient || serverIp;
    const geo = await geolocateIp(ipForGeo);

    await IpLog.create({
      serverIp,
      ipFromClient,
      userAgent,
      page: page?.slice(0, 200),
      geo: geo || undefined,
      note: note?.slice(0, 200),
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /log-ip/recent?limit=50&after=<ISO date>|<ObjectId>
 * - returns newest first
 * - trims fields to reduce payload
 */
router.get("/recent", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const after = req.query.after; // optional cursor

    const filter = {};
    if (after) {
      // support ISO date or ObjectId string
      const dt = new Date(after);
      if (!isNaN(dt.getTime())) {
        filter.createdAt = { $lt: dt };
      } else {
        // ObjectId-style fallback
        filter._id = { $lt: after };
      }
    }

    // Only return the fields you really need in the UI:
    const projection = {
      _id: 1,
      createdAt: 1,
      ipFromClient: 1,
      serverIp: 1,
      page: 1,
      "geo.city": 1,
      "geo.region": 1,
      "geo.country": 1,
    };

    const rows = await IpLog.find(filter, projection)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /log-ip  (alias: same as recent)
 */
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const projection = {
      _id: 1,
      createdAt: 1,
      ipFromClient: 1,
      serverIp: 1,
      page: 1,
      "geo.city": 1,
      "geo.region": 1,
      "geo.country": 1,
    };
    const rows = await IpLog.find({}, projection).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
