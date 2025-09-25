import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "singleton",   // enforce a single document
      immutable: true
    },
    address: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 200
    }
  },
  { timestamps: true }
);

export const Wallet =
  mongoose.models.Wallet || mongoose.model("Wallet", WalletSchema);
