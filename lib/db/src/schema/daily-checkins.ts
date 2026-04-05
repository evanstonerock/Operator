import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyCheckinsTable = pgTable("daily_checkins", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  notes: text("notes").notNull(),
  energyLevel: integer("energy_level").notNull(),
  focusLevel: integer("focus_level").notNull(),
  healthLevel: integer("health_level").notNull(),
  sleepQuality: integer("sleep_quality").notNull(),
  mood: integer("mood").notNull(),
  tasksCompleted: text("tasks_completed").notNull(),
  tasksMissed: text("tasks_missed").notNull(),
  habitsCompleted: text("habits_completed"),
  symptomsNotes: text("symptoms_notes"),
  claudeReflection: text("claude_reflection"),
  openaiPlan: text("openai_plan"),
  combinedAdvice: text("combined_advice"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyCheckinSchema = createInsertSchema(dailyCheckinsTable).omit({
  id: true,
  claudeReflection: true,
  openaiPlan: true,
  combinedAdvice: true,
  createdAt: true,
});

export type InsertDailyCheckin = z.infer<typeof insertDailyCheckinSchema>;
export type DailyCheckin = typeof dailyCheckinsTable.$inferSelect;
