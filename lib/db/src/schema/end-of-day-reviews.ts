import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const endOfDayReviewsTable = pgTable("end_of_day_reviews", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  sleepHours: real("sleep_hours"),
  sleepScore: integer("sleep_score"),
  calories: integer("calories"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  waterOz: real("water_oz"),
  steps: integer("steps"),
  workoutCompleted: boolean("workout_completed"),
  workoutType: text("workout_type"),
  habitsCompleted: text("habits_completed"),
  tasksPlanned: integer("tasks_planned"),
  tasksCompleted: integer("tasks_completed"),
  tasksMissed: integer("tasks_missed"),
  calendarCommitments: text("calendar_commitments"),
  healthNotes: text("health_notes"),
  reflection: text("reflection"),
  aiAnalysis: text("ai_analysis"),
  aiPlan: text("ai_plan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEndOfDayReviewSchema = createInsertSchema(endOfDayReviewsTable).omit({
  id: true,
  aiAnalysis: true,
  aiPlan: true,
  createdAt: true,
});

export type InsertEndOfDayReview = z.infer<typeof insertEndOfDayReviewSchema>;
export type EndOfDayReview = typeof endOfDayReviewsTable.$inferSelect;
