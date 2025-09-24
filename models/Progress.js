import mongoose from "mongoose";

const ProgressSchema = new mongoose.Schema(
  {
    progress: {
      type: Number,
      required: true,
      min: 0,
      max: 200 // keep if you want percent-like values
    }
  },
  { timestamps: true }
);

export const Progress = mongoose.model("Progress", ProgressSchema);
