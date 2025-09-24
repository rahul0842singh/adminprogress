// models/IpLog.js
import mongoose from "mongoose";

const GeoSchema = new mongoose.Schema(
  {
    ip: String,
    city: String,
    region: String,   // state/province
    country: String,  // country code/name
    latitude: Number,
    longitude: Number,
    asn: String,      // e.g. AS12345
    org: String,      // ISP/organization
    timezone: String,
  },
  { _id: false }
);

const IpLogSchema = new mongoose.Schema(
  {
    serverIp: { type: String, default: "" },
    ipFromClient: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    page: { type: String, default: "" },
    geo: { type: GeoSchema, default: undefined },
  },
  { timestamps: true }
);

// Re-use if it exists (dev hot reload)
export default mongoose.models.IpLog || mongoose.model("IpLog", IpLogSchema);
