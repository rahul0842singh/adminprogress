import { Router } from "express";
import { Progress } from "../models/Progress.js";
import mongoose from "mongoose";

const router = Router();

// GET /progress
router.get("/", async (_req, res, next) => {
  try {
    const all = await Progress.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    next(err);
  }
});

// POST /progress  (expects { progress: <number> })
router.post("/", async (req, res, next) => {
  try {
    const doc = await Progress.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// PATCH /progress/:id  (partial update, e.g. { progress: 75 })
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "invalid id" });
    }
    const updated = await Progress.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// (Optional) DELETE /progress/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "invalid id" });
    }
    const removed = await Progress.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
