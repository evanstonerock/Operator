import { db, metricsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_METRICS = [
  { name: "Sleep Hours", type: "number" as const, category: "Recovery" as const, targetValue: "8", importanceLevel: 3, sortOrder: 1 },
  { name: "Sleep Quality", type: "number" as const, category: "Recovery" as const, targetValue: "8", importanceLevel: 3, sortOrder: 2 },
  { name: "Mood", type: "number" as const, category: "Recovery" as const, targetValue: "8", importanceLevel: 3, sortOrder: 3 },
  { name: "Calories", type: "number" as const, category: "Nutrition" as const, targetValue: "2000", importanceLevel: 2, sortOrder: 4 },
  { name: "Protein (g)", type: "number" as const, category: "Nutrition" as const, targetValue: "150", importanceLevel: 2, sortOrder: 5 },
  { name: "Steps", type: "number" as const, category: "Activity" as const, targetValue: "10000", importanceLevel: 2, sortOrder: 6 },
  { name: "Workout Completed", type: "checkbox" as const, category: "Activity" as const, targetValue: null, importanceLevel: 3, sortOrder: 7 },
  { name: "Energy Level", type: "number" as const, category: "Productivity" as const, targetValue: "8", importanceLevel: 3, sortOrder: 8 },
  { name: "Focus Level", type: "number" as const, category: "Productivity" as const, targetValue: "8", importanceLevel: 3, sortOrder: 9 },
  { name: "Tasks Completed", type: "text" as const, category: "Productivity" as const, targetValue: null, importanceLevel: 2, sortOrder: 10 },
];

export async function seedDefaultMetrics() {
  try {
    const existing = await db.select().from(metricsTable).limit(1);
    if (existing.length === 0) {
      await db.insert(metricsTable).values(DEFAULT_METRICS);
      logger.info({ count: DEFAULT_METRICS.length }, "Seeded default metrics");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed default metrics");
  }
}
