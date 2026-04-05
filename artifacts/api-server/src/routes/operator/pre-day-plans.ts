import { Router } from "express";
import { db, preDayPlansTable, endOfDayReviewsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreatePreDayPlanBody } from "@workspace/api-zod";

const router = Router();

// GET /api/pre-day-plans
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const plans = await db
      .select()
      .from(preDayPlansTable)
      .orderBy(desc(preDayPlansTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(plans.map(formatPlan));
  } catch (err) {
    req.log.error({ err }, "Failed to list pre-day plans");
    res.status(500).json({ error: "Failed to list pre-day plans" });
  }
});

// POST /api/pre-day-plans
router.post("/", async (req, res) => {
  const parsed = CreatePreDayPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
    return;
  }
  try {
    const { date, tasksPlanned, calendarCommitments, energyNote } = parsed.data;

    // Fetch recent EOD reviews for pattern context (last 7)
    const recentEod = await db
      .select({
        date: endOfDayReviewsTable.date,
        sleepHours: endOfDayReviewsTable.sleepHours,
        steps: endOfDayReviewsTable.steps,
        tasksCompleted: endOfDayReviewsTable.tasksCompleted,
        tasksPlanned: endOfDayReviewsTable.tasksPlanned,
        workoutCompleted: endOfDayReviewsTable.workoutCompleted,
        reflection: endOfDayReviewsTable.reflection,
      })
      .from(endOfDayReviewsTable)
      .orderBy(desc(endOfDayReviewsTable.createdAt))
      .limit(7);

    const patternContext = recentEod.length > 0
      ? "RECENT PATTERNS (last 7 EOD reviews):\n" + recentEod.map(r =>
          `  ${r.date}: sleep ${r.sleepHours ?? "?"}h, steps ${r.steps ?? "?"}, tasks ${r.tasksCompleted ?? "?"}/${r.tasksPlanned ?? "?"}, workout ${r.workoutCompleted ? "yes" : "no"}${r.reflection ? `, note: "${r.reflection.slice(0, 80)}"` : ""}`
        ).join("\n")
      : "No recent EOD data available.";

    const userContext = [
      `Date: ${date}`,
      tasksPlanned ? `Tasks Planned: ${tasksPlanned}` : null,
      calendarCommitments ? `Calendar Commitments: ${calendarCommitments}` : null,
      energyNote ? `Energy/Capacity Note: ${energyNote}` : null,
    ].filter(Boolean).join("\n");

    // Step 1: OpenAI — daily plan (priorities, task order, overload warning)
    let aiPlan = "";
    try {
      const planResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a practical daily scheduler. Create a concrete, realistic plan for today. Be specific and direct.

TODAY'S INPUTS:
${userContext}

${patternContext}

Respond with exactly these sections (plain text, no markdown):

TOP PRIORITY:
[The single most important thing to accomplish today]

TASK ORDER:
1. [First task — do this when energy is highest]
2. [Second task]
3. [Third task]
[Continue if more tasks listed]

CALENDAR BLOCKS:
[How to protect time around the calendar commitments listed]

OVERLOAD CHECK:
[Honest assessment — is today's task list realistic? If not, what to cut or defer]

EXECUTION NOTE:
[One specific tip for today based on the energy note and calendar load]`,
          },
        ],
      });
      aiPlan = planResponse.choices[0]?.message?.content ?? "";
    } catch (err) {
      req.log.error({ err }, "OpenAI daily plan failed");
      aiPlan = "Unable to generate daily plan at this time.";
    }

    // Step 2: Claude — grounding note from recent patterns
    let aiContext = "";
    try {
      const claudeMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are an analytical coach. Based on this person's recent performance data, give a short grounding note (2-3 sentences max) for today. Be specific to the patterns you see — what should they carry into today from recent days?

TODAY'S PLAN:
${userContext}

${patternContext}

OpenAI's plan for today:
${aiPlan}

Give only a short, specific grounding note based on the patterns. No lists, no sections. Just 2-3 honest sentences.`,
          },
        ],
      });
      const block = claudeMsg.content[0];
      aiContext = block.type === "text" ? block.text : "";
    } catch (err) {
      req.log.error({ err }, "Claude grounding note failed");
      aiContext = "Unable to generate pattern context at this time.";
    }

    const [created] = await db
      .insert(preDayPlansTable)
      .values({
        date,
        tasksPlanned: tasksPlanned ?? null,
        calendarCommitments: calendarCommitments ?? null,
        energyNote: energyNote ?? null,
        aiPlan,
        aiContext,
      })
      .returning();

    res.status(201).json(formatPlan(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create pre-day plan");
    res.status(500).json({ error: "Failed to create pre-day plan" });
  }
});

// GET /api/pre-day-plans/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [plan] = await db
      .select()
      .from(preDayPlansTable)
      .where(eq(preDayPlansTable.id, id));
    if (!plan) {
      res.status(404).json({ error: "Pre-day plan not found" });
      return;
    }
    res.json(formatPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Failed to get pre-day plan");
    res.status(500).json({ error: "Failed to get pre-day plan" });
  }
});

// DELETE /api/pre-day-plans/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(preDayPlansTable).where(eq(preDayPlansTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete pre-day plan");
    res.status(500).json({ error: "Failed to delete pre-day plan" });
  }
});

function formatPlan(p: typeof preDayPlansTable.$inferSelect) {
  return {
    id: p.id,
    date: p.date,
    tasksPlanned: p.tasksPlanned,
    calendarCommitments: p.calendarCommitments,
    energyNote: p.energyNote,
    aiPlan: p.aiPlan,
    aiContext: p.aiContext,
    createdAt: p.createdAt.toISOString(),
  };
}

export default router;
