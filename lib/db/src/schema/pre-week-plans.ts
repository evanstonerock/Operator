import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const preWeekPlansTable = pgTable("pre_week_plans", {
  id: serial("id").primaryKey(),
  weekStartDate: text("week_start_date").notNull(),
  goals: text("goals"),
  calendarCommitments: text("calendar_commitments"),
  capacityNote: text("capacity_note"),
  reflection: text("reflection"),
  aiPlan: text("ai_plan"),
  aiContext: text("ai_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPreWeekPlanSchema = createInsertSchema(preWeekPlansTable).omit({
  id: true,
  aiPlan: true,
  aiContext: true,
  createdAt: true,
});

export type InsertPreWeekPlan = z.infer<typeof insertPreWeekPlanSchema>;
export type PreWeekPlan = typeof preWeekPlansTable.$inferSelect;
