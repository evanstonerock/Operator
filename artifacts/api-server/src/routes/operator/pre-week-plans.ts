import { Router } from "express";
import { db, preWeekPlansTable, endOfDayReviewsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreatePreWeekPlanBody } from "@workspace/api-zod";

const router = Router();

// GET /api/pre-week-plans
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const plans = await db
      .select()
      .from(preWeekPlansTable)
      .orderBy(desc(preWeekPlansTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(plans.map(formatPlan));
  } catch (err) {
    req.log.error({ err }, "Failed to list pre-week plans");
    res.status(500).json({ error: "Failed to list pre-week plans" });
  }
});

// POST /api/pre-week-plans
router.post("/", async (req, res) => {
  const parsed = CreatePreWeekPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
    return;
  }
  try {
    const { weekStartDate, goals, calendarCommitments, capacityNote, reflection } = parsed.data;

    // Fetch recent EOD reviews for pattern context (last 14 days)
    const recentEod = await db
      .select({
        date: endOfDayReviewsTable.date,
        sleepHours: endOfDayReviewsTable.sleepHours,
        steps: endOfDayReviewsTable.steps,
        tasksCompleted: endOfDayReviewsTable.tasksCompleted,
        tasksPlanned: endOfDayReviewsTable.tasksPlanned,
        workoutCompleted: endOfDayReviewsTable.workoutCompleted,
        calories: endOfDayReviewsTable.calories,
        reflection: endOfDayReviewsTable.reflection,
      })
      .from(endOfDayReviewsTable)
      .orderBy(desc(endOfDayReviewsTable.createdAt))
      .limit(14);

    const patternContext = recentEod.length > 0
      ? "RECENT PATTERNS (last 14 EOD reviews):\n" + recentEod.map(r =>
          `  ${r.date}: sleep ${r.sleepHours ?? "?"}h, steps ${r.steps ?? "?"}, tasks ${r.tasksCompleted ?? "?"}/${r.tasksPlanned ?? "?"}, workout ${r.workoutCompleted ? "yes" : "no"}${r.calories ? `, ${r.calories}cal` : ""}${r.reflection ? `, "${r.reflection.slice(0, 60)}"` : ""}`
        ).join("\n")
      : "No recent EOD data available.";

    const userContext = [
      `Week Starting: ${weekStartDate}`,
      goals ? `Goals: ${goals}` : null,
      calendarCommitments ? `Calendar Commitments: ${calendarCommitments}` : null,
      capacityNote ? `Capacity Note: ${capacityNote}` : null,
      reflection ? `Reflection: ${reflection}` : null,
    ].filter(Boolean).join("\n");

    // Step 1: OpenAI — weekly structure (focus days, admin days, priorities, risks)
    let aiPlan = "";
    try {
      const planResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a strategic weekly planner. Create a concrete, realistic weekly structure for this person. Be specific about days and tradeoffs.

THIS WEEK'S INPUTS:
${userContext}

${patternContext}

Respond with exactly these sections (plain text, no markdown):

FOCUS DAYS:
[Which specific days to protect for deep work and why, based on calendar load]

ADMIN DAYS:
[Which day(s) for logistics, shallow tasks, planning — be specific]

WEEKLY PRIORITIES:
1. [Most critical outcome for the week]
2. [Second priority]
3. [Third priority]

PROBLEM SPOTS:
[2-3 specific risks or failure modes to watch — based on the calendar, goals, and recent patterns]

WEEKLY INTENTION:
[One honest sentence capturing the right approach for this week given the data]`,
          },
        ],
      });
      aiPlan = planResponse.choices[0]?.message?.content ?? "";
    } catch (err) {
      req.log.error({ err }, "OpenAI weekly plan failed");
      aiPlan = "Unable to generate weekly plan at this time.";
    }

    // Step 2: Claude — pattern context note
    let aiContext = "";
    try {
      const claudeMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are an analytical coach. Based on the last two weeks of this person's performance data, give a short pattern context note (3-4 sentences max) grounding them for the week ahead. Be specific — what patterns from recent weeks should inform how they approach this coming week?

THIS WEEK'S PLAN:
${userContext}

${patternContext}

WEEKLY STRUCTURE:
${aiPlan}

Give only a short, specific pattern observation. No lists. Just 3-4 honest, direct sentences about what the data says.`,
          },
        ],
      });
      const block = claudeMsg.content[0];
      aiContext = block.type === "text" ? block.text : "";
    } catch (err) {
      req.log.error({ err }, "Claude pattern context failed");
      aiContext = "Unable to generate pattern context at this time.";
    }

    const [created] = await db
      .insert(preWeekPlansTable)
      .values({
        weekStartDate,
        goals: goals ?? null,
        calendarCommitments: calendarCommitments ?? null,
        capacityNote: capacityNote ?? null,
        reflection: reflection ?? null,
        aiPlan,
        aiContext,
      })
      .returning();

    res.status(201).json(formatPlan(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create pre-week plan");
    res.status(500).json({ error: "Failed to create pre-week plan" });
  }
});

// GET /api/pre-week-plans/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [plan] = await db
      .select()
      .from(preWeekPlansTable)
      .where(eq(preWeekPlansTable.id, id));
    if (!plan) {
      res.status(404).json({ error: "Pre-week plan not found" });
      return;
    }
    res.json(formatPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Failed to get pre-week plan");
    res.status(500).json({ error: "Failed to get pre-week plan" });
  }
});

// PATCH /api/pre-week-plans/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(preWeekPlansTable).where(eq(preWeekPlansTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Pre-week plan not found" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const updates: Partial<typeof preWeekPlansTable.$inferInsert> = {};
    if (body.weekStartDate !== undefined) updates.weekStartDate = String(body.weekStartDate);
    if (body.goals !== undefined) updates.goals = body.goals != null ? String(body.goals) : null;
    if (body.calendarCommitments !== undefined) updates.calendarCommitments = body.calendarCommitments != null ? String(body.calendarCommitments) : null;
    if (body.capacityNote !== undefined) updates.capacityNote = body.capacityNote != null ? String(body.capacityNote) : null;
    if (body.reflection !== undefined) updates.reflection = body.reflection != null ? String(body.reflection) : null;
    const [updated] = await db.update(preWeekPlansTable).set(updates).where(eq(preWeekPlansTable.id, id)).returning();
    res.json(formatPlan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update pre-week plan");
    res.status(500).json({ error: "Failed to update pre-week plan" });
  }
});

// DELETE /api/pre-week-plans/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(preWeekPlansTable).where(eq(preWeekPlansTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete pre-week plan");
    res.status(500).json({ error: "Failed to delete pre-week plan" });
  }
});

function formatPlan(p: typeof preWeekPlansTable.$inferSelect) {
  return {
    id: p.id,
    weekStartDate: p.weekStartDate,
    goals: p.goals,
    calendarCommitments: p.calendarCommitments,
    capacityNote: p.capacityNote,
    reflection: p.reflection,
    aiPlan: p.aiPlan,
    aiContext: p.aiContext,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
