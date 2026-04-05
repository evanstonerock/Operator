import { Router } from "express";
import { db, metricLogsTable, metricsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

// GET /api/metric-logs?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  const date = req.query.date as string;
  if (!date) {
    res.status(400).json({ error: "date query parameter is required (YYYY-MM-DD)" });
    return;
  }
  try {
    const logs = await db
      .select({
        id: metricLogsTable.id,
        date: metricLogsTable.date,
        metricId: metricLogsTable.metricId,
        value: metricLogsTable.value,
        createdAt: metricLogsTable.createdAt,
        metricName: metricsTable.name,
        metricType: metricsTable.type,
        metricCategory: metricsTable.category,
      })
      .from(metricLogsTable)
      .innerJoin(metricsTable, eq(metricLogsTable.metricId, metricsTable.id))
      .where(eq(metricLogsTable.date, date));

    res.json(logs.map(l => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch metric logs");
    res.status(500).json({ error: "Failed to fetch metric logs" });
  }
});

// POST /api/metric-logs  (upsert one or more entries for a date)
// Body: { date: string, entries: Array<{ metricId: number, value: string }> }
// Entries with empty value string are treated as deletions (clears the log for that metric/date)
router.post("/", async (req, res) => {
  const { date, entries } = req.body;
  if (!date || !Array.isArray(entries)) {
    res.status(400).json({ error: "date and entries[] are required" });
    return;
  }

  try {
    const allMetricIds = entries.map((e: { metricId: number }) => e.metricId);

    // Separate entries into upserts and deletes
    const toUpsert = entries.filter((e: { metricId: number; value: string }) =>
      e.value !== "" && e.value !== undefined && e.value !== null
    );
    const toDelete = entries.filter((e: { metricId: number; value: string }) =>
      e.value === "" || e.value === undefined || e.value === null
    );

    // Delete cleared entries
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((e: { metricId: number }) => e.metricId);
      await db
        .delete(metricLogsTable)
        .where(and(
          eq(metricLogsTable.date, date),
          inArray(metricLogsTable.metricId, deleteIds)
        ));
    }

    // Upsert non-empty entries using ON CONFLICT DO UPDATE
    let upserted: typeof metricLogsTable.$inferSelect[] = [];
    if (toUpsert.length > 0) {
      const rows = toUpsert.map((e: { metricId: number; value: string }) => ({
        date,
        metricId: e.metricId,
        value: String(e.value),
      }));

      upserted = await db
        .insert(metricLogsTable)
        .values(rows)
        .onConflictDoUpdate({
          target: [metricLogsTable.date, metricLogsTable.metricId],
          set: {
            value: sql`excluded.value`,
            createdAt: sql`now()`,
          },
        })
        .returning();
    }

    res.status(201).json(upserted.map(l => ({
      id: l.id,
      date: l.date,
      metricId: l.metricId,
      value: l.value,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to save metric logs");
    res.status(500).json({ error: "Failed to save metric logs" });
  }
});

export default router;
