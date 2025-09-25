import mongoose from "mongoose";

const PaymentClickSchema = new mongoose.Schema(
  {
    orderId: { type: String, index: true },
    amount: { type: String },
    currency: { type: String },
    address: { type: String },
    sessionId: { type: String, index: true },
    meta: { type: Object }, // page, etc.
  },
  { timestamps: true }
);

export default mongoose.models.PaymentClick ||
  mongoose.model("PaymentClick", PaymentClickSchema);
