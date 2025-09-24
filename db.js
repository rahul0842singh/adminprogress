import mongoose from "mongoose";

export async function connectDB(uri) {
  if (!uri) throw new Error("MONGODB_URI not provided");

  mongoose.set("strictQuery", true);
  // optional extra logging:
  mongoose.connection.on("connected", () => console.log("✅ Mongoose: connected"));
  mongoose.connection.on("open", () => console.log("🔓 Mongoose: connection open"));
  mongoose.connection.on("error", (err) => console.error("❌ Mongoose error:", err));
  mongoose.connection.on("disconnected", () => console.log("🔴 Mongoose: disconnected"));

  console.log("ℹ️ connectDB() called with URI:", uri);
  await mongoose.connect(uri);
  console.log("🔎 readyState after connect:", mongoose.connection.readyState);
}
