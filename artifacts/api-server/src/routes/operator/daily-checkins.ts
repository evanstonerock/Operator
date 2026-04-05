import { Router } from "express";
import { db, dailyCheckinsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { openai } from "@workspace/integrations-openai-ai-server";
import { CreateDailyCheckinBody } from "@workspace/api-zod";

const router = Router();

// GET /api/daily-checkins - list all check-ins
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const checkins = await db
      .select()
      .from(dailyCheckinsTable)
      .orderBy(desc(dailyCheckinsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(checkins.map(formatCheckin));
  } catch (err) {
    req.log.error({ err }, "Failed to list daily check-ins");
    res.status(500).json({ error: "Failed to list check-ins" });
  }
});

// POST /api/daily-checkins - create with AI analysis
router.post("/", async (req, res) => {
  const parsed = CreateDailyCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
    return;
  }
  try {
    const {
      date,
      notes,
      energyLevel,
      focusLevel,
      healthLevel,
      sleepQuality,
      mood,
      tasksCompleted,
      tasksMissed,
      habitsCompleted,
      symptomsNotes,
    } = parsed.data;

    // Build the user context string for AI prompts
    const userContext = `
Date: ${date}
Daily Notes: ${notes}
Energy Level: ${energyLevel}/10
Focus Level: ${focusLevel}/10
Health/Sickness Level: ${healthLevel}/10
Sleep Quality: ${sleepQuality}/10
Mood: ${mood}/10
Tasks Completed: ${tasksCompleted}
Tasks Missed: ${tasksMissed}
${habitsCompleted ? `Habits Completed: ${habitsCompleted}` : ""}
${symptomsNotes ? `Symptoms/Health Notes: ${symptomsNotes}` : ""}
    `.trim();

    // Step 1: Claude reflection
    let claudeReflection = "";
    try {
      const claudeMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a thoughtful personal life coach helping someone understand their day deeply. Analyze this person's daily check-in data and provide an honest, insightful reflection. Be specific to the data they shared — not generic advice.

${userContext}

Provide a structured reflection in plain text (no markdown, no bullet points, just clear readable paragraphs) covering:
1. A clear explanation of why today felt productive or unproductive, based on the specific numbers and notes
2. Likely causes, patterns, or behavior issues you see in the data
3. What felt off or what went right, being specific and honest
4. One key insight from today that they should remember

Be direct, analytical, and honest. If the numbers suggest a rough day, say so and explain why. If they had a great day, identify what contributed. Avoid vague motivational statements.`,
          },
        ],
      });
      const block = claudeMsg.content[0];
      claudeReflection = block.type === "text" ? block.text : "";
    } catch (err) {
      req.log.error({ err }, "Claude reflection failed");
      claudeReflection = "Unable to generate reflection at this time.";
    }

    // Step 2: OpenAI tomorrow plan (receives original data + Claude's reflection)
    let openaiPlan = "";
    try {
      const planResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a practical life planner. Based on this person's daily check-in and the reflection from their coach, create a clear, actionable plan for tomorrow. Be specific — not generic.

DAILY CHECK-IN DATA:
${userContext}

COACH'S REFLECTION:
${claudeReflection}

Create a structured tomorrow plan with exactly these sections (plain text, no markdown):

TOP PRIORITY:
[One clear sentence about the single most important thing for tomorrow]

3 KEY ACTIONS:
1. [Specific actionable task]
2. [Specific actionable task]
3. [Specific actionable task]

SUGGESTED TIME BLOCKS:
[A realistic schedule suggestion based on their energy and focus patterns]

ONE THING TO AVOID:
[Based on today's data, one specific behavior or pattern to avoid tomorrow]

IDEAL TONE FOR TOMORROW:
[A short sentence on the mindset or energy they should bring to tomorrow]`,
          },
        ],
      });
      openaiPlan = planResponse.choices[0]?.message?.content ?? "";
    } catch (err) {
      req.log.error({ err }, "OpenAI planning failed");
      openaiPlan = "Unable to generate plan at this time.";
    }

    // Step 3: Combined advice (merge Claude insight + OpenAI practical output)
    let combinedAdvice = "";
    if (claudeReflection && openaiPlan) {
      combinedAdvice = buildCombinedDailyAdvice(claudeReflection, openaiPlan, energyLevel, focusLevel, mood);
    }

    // Save to DB
    const [created] = await db
      .insert(dailyCheckinsTable)
      .values({
        date,
        notes,
        energyLevel,
        focusLevel,
        healthLevel,
        sleepQuality,
        mood,
        tasksCompleted,
        tasksMissed,
        habitsCompleted: habitsCompleted ?? null,
        symptomsNotes: symptomsNotes ?? null,
        claudeReflection,
        openaiPlan,
        combinedAdvice,
      })
      .returning();

    res.status(201).json(formatCheckin(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create daily check-in");
    res.status(500).json({ error: "Failed to create check-in" });
  }
});

// GET /api/daily-checkins/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [checkin] = await db
      .select()
      .from(dailyCheckinsTable)
      .where(eq(dailyCheckinsTable.id, id));

    if (!checkin) {
      res.status(404).json({ error: "Check-in not found" });
      return;
    }
    res.json(formatCheckin(checkin));
  } catch (err) {
    req.log.error({ err }, "Failed to get daily check-in");
    res.status(500).json({ error: "Failed to get check-in" });
  }
});

// DELETE /api/daily-checkins/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(dailyCheckinsTable).where(eq(dailyCheckinsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete daily check-in");
    res.status(500).json({ error: "Failed to delete check-in" });
  }
});

function formatCheckin(c: typeof dailyCheckinsTable.$inferSelect) {
  return {
    id: c.id,
    date: c.date,
    notes: c.notes,
    energyLevel: c.energyLevel,
    focusLevel: c.focusLevel,
    healthLevel: c.healthLevel,
    sleepQuality: c.sleepQuality,
    mood: c.mood,
    tasksCompleted: c.tasksCompleted,
    tasksMissed: c.tasksMissed,
    habitsCompleted: c.habitsCompleted,
    symptomsNotes: c.symptomsNotes,
    claudeReflection: c.claudeReflection,
    openaiPlan: c.openaiPlan,
    combinedAdvice: c.combinedAdvice,
    createdAt: c.createdAt.toISOString(),
  };
}

function buildCombinedDailyAdvice(claudeReflection: string, openaiPlan: string, energy: number, focus: number, mood: number): string {
  // Extract key insight from Claude's reflection (first substantial sentence)
  const claudeSentences = claudeReflection.split(". ").filter(s => s.length > 30);
  const keyInsight = claudeSentences.length > 0 ? claudeSentences[0].trim() : claudeReflection.slice(0, 200);

  // Extract top priority from OpenAI plan
  const topPriorityMatch = openaiPlan.match(/TOP PRIORITY:\s*\n?(.*?)(?:\n|$)/i);
  const topPriority = topPriorityMatch ? topPriorityMatch[1].trim() : "";

  const avgScore = Math.round((energy + focus + mood) / 3);
  const dayQuality = avgScore >= 7 ? "strong" : avgScore >= 5 ? "moderate" : "challenging";

  return `Today was a ${dayQuality} day (avg score: ${avgScore}/10). ${keyInsight}. ${topPriority ? `For tomorrow, the most important thing is: ${topPriority}` : ""} This plan is built on your actual data — not generic advice.`;
}

export default router;
