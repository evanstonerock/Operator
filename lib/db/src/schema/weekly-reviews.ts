import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyReviewsTable = pgTable("weekly_reviews", {
  id: serial("id").primaryKey(),
  weekStartDate: text("week_start_date").notNull(),
  weekNotes: text("week_notes").notNull(),
  mainWins: text("main_wins").notNull(),
  mainFrustrations: text("main_frustrations").notNull(),
  energyTrend: text("energy_trend").notNull(),
  healthTrend: text("health_trend").notNull(),
  goalsNextWeek: text("goals_next_week").notNull(),
  existingCommitments: text("existing_commitments").notNull(),
  claudeReflection: text("claude_reflection"),
  openaiPlan: text("openai_plan"),
  combinedAdvice: text("combined_advice"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeeklyReviewSchema = createInsertSchema(weeklyReviewsTable).omit({
  id: true,
  claudeReflection: true,
  openaiPlan: true,
  combinedAdvice: true,
  createdAt: true,
});

export type InsertWeeklyReview = z.infer<typeof insertWeeklyReviewSchema>;
export type WeeklyReview = typeof weeklyReviewsTable.$inferSelect;
