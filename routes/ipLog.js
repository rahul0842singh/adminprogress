// routes/ipLog.js
import { Router } from "express";
import axios from "axios";
import IpLog from "../models/IpLog.js";

const router = Router();

// Optional token (better accuracy/limits). Get one free at ipinfo.io
const IPINFO_TOKEN = process.env.IPINFO_TOKEN || ""; // e.g. ipinfo token

async function geolocateIp(ip) {
  // Skip localhost/empty
  if (!ip || ip === "127.0.0.1" || ip === "::1") return null;

  // Prefer ipinfo if token provided
  if (IPINFO_TOKEN) {
    try {
      const r = await axios.get(`https://ipinfo.io/${encodeURIComponent(ip)}`, {
        params: { token: IPINFO_TOKEN },
        timeout: 4000,
      });
      // ipinfo loc is "lat,lon"
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
        asn: r.data.org?.split(" ")[0], // crude parse: "AS123 ISP Name"
        org: r.data.org || undefined,
        timezone: r.data.timezone || undefined,
      };
    } catch (e) {
      // fall through to ipapi
    }
  }

  // Fallback: ipapi.co (no key required, lower limits)
  try {
    const r = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      timeout: 4000,
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
  } catch (e) {
    return null; // don’t break logging
  }
}

/**
 * POST /log-ip
 * Body: { ipFromClient?: string, userAgent?: string, page?: string }
 */
router.post("/", async (req, res, next) => {
  try {
    const serverIp = req.ip; // requires app.set('trust proxy', true)
    const {
      ipFromClient = "",
      userAgent = req.get("user-agent") || "",
      page = "",
    } = req.body || {};

    // pick the most useful IP to geolocate (client first, then server)
    const ipForGeo = ipFromClient || serverIp;

    const geo = await geolocateIp(ipForGeo);

    await IpLog.create({
      serverIp,
      ipFromClient,
      userAgent,
      page,
      geo: geo || undefined,
    });

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /log-ip/recent?limit=50
 * Inspect what’s stored
 */
router.get("/recent", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
    const rows = await IpLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

export default router;
