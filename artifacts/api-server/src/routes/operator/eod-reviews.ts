import { Router } from "express";
import { db, endOfDayReviewsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreateEodReviewBody } from "@workspace/api-zod";

const router = Router();

// GET /api/eod-reviews
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const reviews = await db
      .select()
      .from(endOfDayReviewsTable)
      .orderBy(desc(endOfDayReviewsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(reviews.map(formatReview));
  } catch (err) {
    req.log.error({ err }, "Failed to list EOD reviews");
    res.status(500).json({ error: "Failed to list EOD reviews" });
  }
});

// POST /api/eod-reviews
router.post("/", async (req, res) => {
  const parsed = CreateEodReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
    return;
  }
  try {
    const data = parsed.data;

    const userContext = buildContext(data);

    // Step 1: Claude — day analysis (drivers, patterns, prediction)
    let aiAnalysis = "";
    try {
      const claudeMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are an analytical personal performance coach. Review this person's end-of-day data and provide sharp, specific insights. No fluff, no motivational language — just honest analysis.

${userContext}

Provide a structured insight in plain paragraphs (no markdown, no bullet points) covering:
1. DRIVERS: What likely drove today's outcomes? Be specific to the numbers and context provided.
2. PATTERNS: What recurring patterns or correlations do you notice in this data? (e.g. low sleep → low task completion, workout affecting nutrition choices)
3. PREDICTION: Based on what you see, what should this person watch for tomorrow or over the next few days? Give a specific, honest forecast.

Keep it under 400 words. Be direct. Avoid generic statements.`,
          },
        ],
      });
      const block = claudeMsg.content[0];
      aiAnalysis = block.type === "text" ? block.text : "";
    } catch (err) {
      req.log.error({ err }, "Claude EOD analysis failed");
      aiAnalysis = "Unable to generate analysis at this time.";
    }

    // Step 2: OpenAI — tomorrow plan
    let aiPlan = "";
    try {
      const planResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a practical daily planner. Based on today's data and the insight below, give a clear, actionable tomorrow recommendation. Be concrete and specific.

TODAY'S DATA:
${userContext}

ANALYST'S INSIGHT:
${aiAnalysis}

Respond with exactly these sections (plain text, no markdown):

TOMORROW'S PRIORITY:
[One clear sentence — the single most important focus for tomorrow]

3 ACTIONS:
1. [Specific action based on today's data]
2. [Specific action]
3. [Specific action]

ONE THING TO AVOID:
[Based on today's patterns, the specific behavior or choice to avoid tomorrow]

OPTIMAL TONE:
[One sentence — the energy/mindset this person should bring tomorrow given today's data]`,
          },
        ],
      });
      aiPlan = planResponse.choices[0]?.message?.content ?? "";
    } catch (err) {
      req.log.error({ err }, "OpenAI tomorrow plan failed");
      aiPlan = "Unable to generate tomorrow plan at this time.";
    }

    const [created] = await db
      .insert(endOfDayReviewsTable)
      .values({
        date: data.date,
        sleepHours: data.sleepHours ?? null,
        sleepScore: data.sleepScore ?? null,
        calories: data.calories ?? null,
        proteinG: data.proteinG ?? null,
        carbsG: data.carbsG ?? null,
        fatG: data.fatG ?? null,
        waterOz: data.waterOz ?? null,
        steps: data.steps ?? null,
        workoutCompleted: data.workoutCompleted ?? null,
        workoutType: data.workoutType ?? null,
        habitsCompleted: data.habitsCompleted ?? null,
        tasksPlanned: data.tasksPlanned ?? null,
        tasksCompleted: data.tasksCompleted ?? null,
        tasksMissed: data.tasksMissed ?? null,
        calendarCommitments: data.calendarCommitments ?? null,
        healthNotes: data.healthNotes ?? null,
        reflection: data.reflection ?? null,
        aiAnalysis,
        aiPlan,
      })
      .returning();

    res.status(201).json(formatReview(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create EOD review");
    res.status(500).json({ error: "Failed to create EOD review" });
  }
});

// GET /api/eod-reviews/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [review] = await db
      .select()
      .from(endOfDayReviewsTable)
      .where(eq(endOfDayReviewsTable.id, id));
    if (!review) {
      res.status(404).json({ error: "EOD review not found" });
      return;
    }
    res.json(formatReview(review));
  } catch (err) {
    req.log.error({ err }, "Failed to get EOD review");
    res.status(500).json({ error: "Failed to get EOD review" });
  }
});

// DELETE /api/eod-reviews/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(endOfDayReviewsTable).where(eq(endOfDayReviewsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete EOD review");
    res.status(500).json({ error: "Failed to delete EOD review" });
  }
});

function buildContext(data: Record<string, unknown>): string {
  const lines: string[] = [`Date: ${data.date}`];
  if (data.sleepHours != null) lines.push(`Sleep: ${data.sleepHours}h`);
  if (data.sleepScore != null) lines.push(`Sleep Score: ${data.sleepScore}/10`);
  if (data.calories != null) lines.push(`Calories: ${data.calories}`);
  if (data.proteinG != null) lines.push(`Protein: ${data.proteinG}g`);
  if (data.carbsG != null) lines.push(`Carbs: ${data.carbsG}g`);
  if (data.fatG != null) lines.push(`Fat: ${data.fatG}g`);
  if (data.waterOz != null) lines.push(`Water: ${data.waterOz}oz`);
  if (data.steps != null) lines.push(`Steps: ${data.steps}`);
  if (data.workoutCompleted != null) lines.push(`Workout: ${data.workoutCompleted ? "Yes" : "No"}${data.workoutType ? ` (${data.workoutType})` : ""}`);
  if (data.habitsCompleted) lines.push(`Habits Completed: ${data.habitsCompleted}`);
  if (data.tasksPlanned != null) lines.push(`Tasks Planned: ${data.tasksPlanned}`);
  if (data.tasksCompleted != null) lines.push(`Tasks Completed: ${data.tasksCompleted}`);
  if (data.tasksMissed != null) lines.push(`Tasks Missed: ${data.tasksMissed}`);
  if (data.calendarCommitments) lines.push(`Calendar Commitments: ${data.calendarCommitments}`);
  if (data.healthNotes) lines.push(`Health Notes: ${data.healthNotes}`);
  if (data.reflection) lines.push(`Reflection: ${data.reflection}`);
  return lines.join("\n");
}

function formatReview(r: typeof endOfDayReviewsTable.$inferSelect) {
  return {
    id: r.id,
    date: r.date,
    sleepHours: r.sleepHours,
    sleepScore: r.sleepScore,
    calories: r.calories,
    proteinG: r.proteinG,
    carbsG: r.carbsG,
    fatG: r.fatG,
    waterOz: r.waterOz,
    steps: r.steps,
    workoutCompleted: r.workoutCompleted,
    workoutType: r.workoutType,
    habitsCompleted: r.habitsCompleted,
    tasksPlanned: r.tasksPlanned,
    tasksCompleted: r.tasksCompleted,
    tasksMissed: r.tasksMissed,
    calendarCommitments: r.calendarCommitments,
    healthNotes: r.healthNotes,
    reflection: r.reflection,
    aiAnalysis: r.aiAnalysis,
    aiPlan: r.aiPlan,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
