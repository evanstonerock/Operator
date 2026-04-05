import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metricTypeEnum = pgEnum("metric_type", ["number", "checkbox", "toggle", "dropdown", "text"]);
export const metricCategoryEnum = pgEnum("metric_category", ["Recovery", "Nutrition", "Activity", "Productivity", "Custom"]);

export const metricsTable = pgTable("metrics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: metricTypeEnum("type").notNull(),
  category: metricCategoryEnum("category").notNull(),
  targetValue: text("target_value"),
  importanceLevel: integer("importance_level"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricLogsTable = pgTable("metric_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  metricId: integer("metric_id").notNull().references(() => metricsTable.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("metric_logs_date_metric_id_unique").on(table.date, table.metricId),
]);

export const insertMetricSchema = createInsertSchema(metricsTable).omit({
  id: true,
  createdAt: true,
});

export const insertMetricLogSchema = createInsertSchema(metricLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = typeof metricsTable.$inferSelect;
export type InsertMetricLog = z.infer<typeof insertMetricLogSchema>;
export type MetricLog = typeof metricLogsTable.$inferSelect;
