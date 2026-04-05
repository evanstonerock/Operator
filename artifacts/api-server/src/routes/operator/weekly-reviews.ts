import { Router } from "express";
import { db, weeklyReviewsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// GET /api/weekly-reviews
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const reviews = await db
      .select()
      .from(weeklyReviewsTable)
      .orderBy(desc(weeklyReviewsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(reviews.map(formatReview));
  } catch (err) {
    req.log.error({ err }, "Failed to list weekly reviews");
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

// POST /api/weekly-reviews - create with AI analysis
router.post("/", async (req, res) => {
  try {
    const {
      weekStartDate,
      weekNotes,
      mainWins,
      mainFrustrations,
      energyTrend,
      healthTrend,
      goalsNextWeek,
      existingCommitments,
    } = req.body;

    const userContext = `
Week Starting: ${weekStartDate}
Weekly Notes: ${weekNotes}
Main Wins: ${mainWins}
Main Frustrations: ${mainFrustrations}
Energy Trend: ${energyTrend}
Health Trend: ${healthTrend}
Goals for Next Week: ${goalsNextWeek}
Existing Commitments: ${existingCommitments}
    `.trim();

    // Step 1: Claude weekly reflection
    let claudeReflection = "";
    try {
      const claudeMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a thoughtful personal life coach helping someone understand their week deeply. Analyze this person's weekly review and provide an honest, insightful reflection. Be specific to what they shared.

${userContext}

Provide a structured weekly reflection in plain text (clear paragraphs, no markdown, no bullet points) covering:
1. A clear assessment of the overall quality of this week and why it felt the way it did
2. Patterns across the week — what recurring themes, behaviors, or circumstances shaped the week
3. Likely underlying issues affecting productivity or recovery that they might not see clearly
4. What went right and why it worked, being specific
5. One significant insight from this week that should inform how they approach next week

Be direct, analytical, and honest. Avoid motivational platitudes. Give them the honest read on their week.`,
          },
        ],
      });
      const block = claudeMsg.content[0];
      claudeReflection = block.type === "text" ? block.text : "";
    } catch (err) {
      req.log.error({ err }, "Claude weekly reflection failed");
      claudeReflection = "Unable to generate weekly reflection at this time.";
    }

    // Step 2: OpenAI next-week plan
    let openaiPlan = "";
    try {
      const planResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a practical weekly life planner. Based on this person's weekly review and coach's reflection, create a clear, actionable plan for next week. Be specific, not generic.

WEEKLY REVIEW DATA:
${userContext}

COACH'S WEEKLY REFLECTION:
${claudeReflection}

Create a structured next-week plan with exactly these sections (plain text, no markdown):

FOCUS DAYS:
[List specific days and what to focus on during them]

ADMIN DAYS:
[Which day(s) to handle logistics, errands, planning]

RECOVERY DAYS:
[Which day(s) to prioritize rest and recharge]

WEEKLY PRIORITIES:
1. [Most important priority for the week]
2. [Second priority]
3. [Third priority]

RISKS TO AVOID:
[2-3 specific risks or failure modes to watch for, based on their frustrations and trends]

WEEKLY INTENTION:
[One sentence capturing the right mindset for this coming week]`,
          },
        ],
      });
      openaiPlan = planResponse.choices[0]?.message?.content ?? "";
    } catch (err) {
      req.log.error({ err }, "OpenAI weekly planning failed");
      openaiPlan = "Unable to generate weekly plan at this time.";
    }

    // Step 3: Combined weekly advice
    let combinedAdvice = "";
    if (claudeReflection && openaiPlan) {
      combinedAdvice = buildCombinedWeeklyAdvice(claudeReflection, openaiPlan, energyTrend, mainWins);
    }

    // Save to DB
    const [created] = await db
      .insert(weeklyReviewsTable)
      .values({
        weekStartDate,
        weekNotes,
        mainWins,
        mainFrustrations,
        energyTrend,
        healthTrend,
        goalsNextWeek,
        existingCommitments,
        claudeReflection,
        openaiPlan,
        combinedAdvice,
      })
      .returning();

    res.status(201).json(formatReview(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create weekly review");
    res.status(500).json({ error: "Failed to create weekly review" });
  }
});

// GET /api/weekly-reviews/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [review] = await db
      .select()
      .from(weeklyReviewsTable)
      .where(eq(weeklyReviewsTable.id, id));

    if (!review) {
      res.status(404).json({ error: "Weekly review not found" });
      return;
    }
    res.json(formatReview(review));
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly review");
    res.status(500).json({ error: "Failed to get weekly review" });
  }
});

// DELETE /api/weekly-reviews/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(weeklyReviewsTable).where(eq(weeklyReviewsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete weekly review");
    res.status(500).json({ error: "Failed to delete weekly review" });
  }
});

function formatReview(r: typeof weeklyReviewsTable.$inferSelect) {
  return {
    id: r.id,
    weekStartDate: r.weekStartDate,
    weekNotes: r.weekNotes,
    mainWins: r.mainWins,
    mainFrustrations: r.mainFrustrations,
    energyTrend: r.energyTrend,
    healthTrend: r.healthTrend,
    goalsNextWeek: r.goalsNextWeek,
    existingCommitments: r.existingCommitments,
    claudeReflection: r.claudeReflection,
    openaiPlan: r.openaiPlan,
    combinedAdvice: r.combinedAdvice,
    createdAt: r.createdAt.toISOString(),
  };
}

function buildCombinedWeeklyAdvice(claudeReflection: string, openaiPlan: string, energyTrend: string, mainWins: string): string {
  const claudeSentences = claudeReflection.split(". ").filter(s => s.length > 30);
  const keyInsight = claudeSentences.length > 0 ? claudeSentences[0].trim() : claudeReflection.slice(0, 200);

  const weeklyIntentionMatch = openaiPlan.match(/WEEKLY INTENTION:\s*\n?(.*?)(?:\n|$)/i);
  const weeklyIntention = weeklyIntentionMatch ? weeklyIntentionMatch[1].trim() : "";

  const energySummary = energyTrend === "improving" ? "Your energy is heading in the right direction."
    : energyTrend === "declining" ? "Your energy needs attention next week."
    : energyTrend === "stable" ? "Your energy has been consistent."
    : "Your energy has been mixed — watch for patterns.";

  return `${energySummary} ${keyInsight}. ${weeklyIntention ? `Going into next week: ${weeklyIntention}` : ""} Use your wins from this week (${mainWins.slice(0, 80)}${mainWins.length > 80 ? "..." : ""}) as fuel.`;
}

export default router;
