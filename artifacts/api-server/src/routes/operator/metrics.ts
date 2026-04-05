import { Router } from "express";
import { db, metricsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const VALID_TYPES = ["number", "checkbox", "toggle", "dropdown", "text", "duration", "scale"];
const VALID_CATEGORIES = ["Recovery", "Nutrition", "Activity", "Productivity", "Custom"];

// GET /api/metrics
router.get("/", async (req, res) => {
  try {
    const metrics = await db
      .select()
      .from(metricsTable)
      .where(eq(metricsTable.isActive, true))
      .orderBy(metricsTable.displayOrder, metricsTable.sortOrder, metricsTable.id);
    res.json(metrics.map(formatMetric));
  } catch (err) {
    req.log.error({ err }, "Failed to list metrics");
    res.status(500).json({ error: "Failed to list metrics" });
  }
});

// POST /api/metrics
router.post("/", async (req, res) => {
  const { name, type, category, unit, targetValue, aiContext, importanceLevel, sortOrder, displayOrder } = req.body;
  if (!name || !type || !category) {
    res.status(400).json({ error: "name, type, and category are required" });
    return;
  }
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    return;
  }
  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
    return;
  }
  try {
    const [created] = await db.insert(metricsTable).values({
      name,
      type,
      category,
      unit: unit ?? null,
      targetValue: targetValue ?? null,
      aiContext: aiContext ?? null,
      importanceLevel: importanceLevel ?? null,
      sortOrder: sortOrder ?? 0,
      displayOrder: displayOrder ?? 0,
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
  const { name, type, category, unit, targetValue, aiContext, importanceLevel, sortOrder, displayOrder, isActive } = req.body;

  if (type && !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
    return;
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
    return;
  }

  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (unit !== undefined) updates.unit = unit;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (aiContext !== undefined) updates.aiContext = aiContext;
    if (importanceLevel !== undefined) updates.importanceLevel = importanceLevel;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
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
    unit: m.unit,
    targetValue: m.targetValue,
    aiContext: m.aiContext,
    importanceLevel: m.importanceLevel,
    sortOrder: m.sortOrder,
    displayOrder: m.displayOrder,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
  };
}

export default router;
