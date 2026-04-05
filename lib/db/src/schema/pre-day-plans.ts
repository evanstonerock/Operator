import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const preDayPlansTable = pgTable("pre_day_plans", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  tasksPlanned: text("tasks_planned"),
  calendarCommitments: text("calendar_commitments"),
  energyNote: text("energy_note"),
  aiPlan: text("ai_plan"),
  aiContext: text("ai_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPreDayPlanSchema = createInsertSchema(preDayPlansTable).omit({
  id: true,
  aiPlan: true,
  aiContext: true,
  createdAt: true,
});

export type InsertPreDayPlan = z.infer<typeof insertPreDayPlanSchema>;
export type PreDayPlan = typeof preDayPlansTable.$inferSelect;
