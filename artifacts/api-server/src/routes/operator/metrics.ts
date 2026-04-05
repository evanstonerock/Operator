import { Router } from "express";
import { db, metricsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/metrics
router.get("/", async (req, res) => {
  try {
    const metrics = await db
      .select()
      .from(metricsTable)
      .where(eq(metricsTable.isActive, true))
      .orderBy(metricsTable.sortOrder, metricsTable.id);
    res.json(metrics.map(formatMetric));
  } catch (err) {
    req.log.error({ err }, "Failed to list metrics");
    res.status(500).json({ error: "Failed to list metrics" });
  }
});

// POST /api/metrics
router.post("/", async (req, res) => {
  const { name, type, category, targetValue, importanceLevel, sortOrder } = req.body;
  if (!name || !type || !category) {
    res.status(400).json({ error: "name, type, and category are required" });
    return;
  }
  const validTypes = ["number", "checkbox", "toggle", "dropdown", "text"];
  const validCategories = ["Recovery", "Nutrition", "Activity", "Productivity", "Custom"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }
  if (!validCategories.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${validCategories.join(", ")}` });
    return;
  }
  try {
    const [created] = await db.insert(metricsTable).values({
      name,
      type,
      category,
      targetValue: targetValue ?? null,
      importanceLevel: importanceLevel ?? null,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(formatMetric(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create metric");
    res.status(500).json({ error: "Failed to create metric" });
  }
});

// PATCH /api/metrics/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, type, category, targetValue, importanceLevel, sortOrder, isActive } = req.body;

  const validTypes = ["number", "checkbox", "toggle", "dropdown", "text"];
  const validCategories = ["Recovery", "Nutrition", "Activity", "Productivity", "Custom"];

  if (type && !validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }
  if (category && !validCategories.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${validCategories.join(", ")}` });
    return;
  }

  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (importanceLevel !== undefined) updates.importanceLevel = importanceLevel;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(metricsTable).set(updates).where(eq(metricsTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }
    res.json(formatMetric(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update metric");
    res.status(500).json({ error: "Failed to update metric" });
  }
});

// DELETE /api/metrics/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(metricsTable).where(eq(metricsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete metric");
    res.status(500).json({ error: "Failed to delete metric" });
  }
});

function formatMetric(m: typeof metricsTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    category: m.category,
    targetValue: m.targetValue,
    importanceLevel: m.importanceLevel,
    sortOrder: m.sortOrder,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
  };
}

export default router;
