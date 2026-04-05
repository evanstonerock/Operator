import { Router } from "express";
import { db, dailyCheckinsTable, metricLogsTable, metricsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
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
      reflectionFeltGood,
      reflectionFeltOff,
      reflectionGotInWay,
      reflectionAnythingUnusual,
    } = parsed.data;

    // Fetch ALL active trackable definitions + today's logged values
    let metricLogsContext = "";
    let trackableDefinitions = "";
    try {
      // All active trackables (for full definitions context)
      const allMetrics = await db
        .select()
        .from(metricsTable)
        .where(eq(metricsTable.isActive, true))
        .orderBy(metricsTable.displayOrder, metricsTable.sortOrder, metricsTable.id);

      // Logged values for today
      const logs = await db
        .select({
          value: metricLogsTable.value,
          metricId: metricLogsTable.metricId,
        })
        .from(metricLogsTable)
        .where(and(eq(metricLogsTable.date, date)));

      const logMap = new Map(logs.map(l => [l.metricId, l.value]));

      if (allMetrics.length > 0) {
        // Trackable definitions for all configured trackables
        trackableDefinitions = "\nAll Configured Trackables:\n" + allMetrics.map(m => {
          const parts = [`  ${m.name} (${m.type}, ${m.category})`];
          if (m.unit) parts.push(`unit: ${m.unit}`);
          if (m.targetValue) parts.push(`target: ${m.targetValue}`);
          if (m.aiContext) parts.push(`context: ${m.aiContext}`);
          return parts.join(", ");
        }).join("\n");

        // Logged values for metrics that have entries today
        const loggedMetrics = allMetrics.filter(m => logMap.has(m.id));
        if (loggedMetrics.length > 0) {
          metricLogsContext = "\nLogged Values Today:\n" + loggedMetrics.map(m => {
            const value = logMap.get(m.id) ?? "";
            const unit = m.unit ? ` ${m.unit}` : "";
            const target = m.targetValue ? ` (target: ${m.targetValue}${unit})` : "";
            return `  ${m.name} [${m.category}]: ${value}${unit}${target}`;
          }).join("\n");
        }
      }
    } catch (_e) {
      // non-fatal, continue without metric logs
    }

    // Build the end-of-day reflection context
    const reflectionContext = [
      reflectionFeltGood ? `What felt good: ${reflectionFeltGood}` : "",
      reflectionFeltOff ? `What felt off: ${reflectionFeltOff}` : "",
      reflectionGotInWay ? `What got in the way: ${reflectionGotInWay}` : "",
      reflectionAnythingUnusual ? `Anything unusual: ${reflectionAnythingUnusual}` : "",
    ].filter(Boolean).join("\n");

    // Build the user context string for AI prompts
    const userContext = `
Date: ${date}
${notes ? `Notes: ${notes}` : ""}${metricLogsContext}${trackableDefinitions ? `\n${trackableDefinitions}` : ""}
${reflectionContext ? `\nEnd-of-Day Reflection:\n${reflectionContext}` : ""}
    `.trim();

    // Step 1: Claude reflection using trackable definitions + logged values + reflection
    let claudeReflection = "";
    try {
      const claudeMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are a thoughtful personal life coach helping someone understand their day deeply. The user has defined custom trackables with specific context about what each metric means to them. Use this context to provide highly personalized analysis.

${userContext}

Analyze the logged values in light of each trackable's defined context (the "context" field explains what that metric means to the user). Identify patterns, cause-and-effect relationships, and what the data tells us about today.

Provide a structured reflection in plain text (no markdown, no bullet points, just clear readable paragraphs) covering:
1. What the data actually shows — specific observations tied to the logged values and their targets
2. Patterns or connections between different tracked areas (e.g. how sleep affected energy, how activity affected mood)
3. What the end-of-day reflection reveals about the user's experience vs. what the numbers show
4. One key insight from today that is specific to this person's tracking setup

Be direct, analytical, and honest. Reference specific metrics and their values. Avoid generic advice.`,
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
            content: `You are a practical life planner. Based on this person's custom-tracked daily data and the coach's reflection, create a clear, actionable plan for tomorrow tailored to what they actually track.

DAILY DATA:
${userContext}

COACH'S REFLECTION:
${claudeReflection}

Create a structured tomorrow plan with exactly these sections (plain text, no markdown):

TOP PRIORITY:
[One clear sentence about the single most important thing for tomorrow, grounded in today's data]

3 KEY ACTIONS:
1. [Specific actionable task tied to their tracking areas]
2. [Specific actionable task tied to their tracking areas]
3. [Specific actionable task tied to their tracking areas]

SUGGESTED FOCUS AREAS:
[Based on their trackables, which areas need the most attention tomorrow and why]

ONE THING TO AVOID:
[Based on today's data and patterns, one specific behavior or pattern to avoid tomorrow]

IDEAL APPROACH FOR TOMORROW:
[A short sentence on the mindset or approach they should bring, based on their specific tracked patterns]`,
          },
        ],
      });
      openaiPlan = planResponse.choices[0]?.message?.content ?? "";
    } catch (err) {
      req.log.error({ err }, "OpenAI planning failed");
      openaiPlan = "Unable to generate plan at this time.";
    }

    // Step 3: Combined advice
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
        reflectionFeltGood: reflectionFeltGood ?? null,
        reflectionFeltOff: reflectionFeltOff ?? null,
        reflectionGotInWay: reflectionGotInWay ?? null,
        reflectionAnythingUnusual: reflectionAnythingUnusual ?? null,
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
    reflectionFeltGood: c.reflectionFeltGood,
    reflectionFeltOff: c.reflectionFeltOff,
    reflectionGotInWay: c.reflectionGotInWay,
    reflectionAnythingUnusual: c.reflectionAnythingUnusual,
    claudeReflection: c.claudeReflection,
    openaiPlan: c.openaiPlan,
    combinedAdvice: c.combinedAdvice,
    createdAt: c.createdAt.toISOString(),
  };
}

function buildCombinedDailyAdvice(claudeReflection: string, openaiPlan: string, energy: number, focus: number, mood: number): string {
  const claudeSentences = claudeReflection.split(". ").filter(s => s.length > 30);
  const keyInsight = claudeSentences.length > 0 ? claudeSentences[0].trim() : claudeReflection.slice(0, 200);

  const topPriorityMatch = openaiPlan.match(/TOP PRIORITY:\s*\n?(.*?)(?:\n|$)/i);
  const topPriority = topPriorityMatch ? topPriorityMatch[1].trim() : "";

  const avgScore = Math.round((energy + focus + mood) / 3);
  const dayQuality = avgScore >= 7 ? "strong" : avgScore >= 5 ? "moderate" : "challenging";

  return `Today was a ${dayQuality} day (avg score: ${avgScore}/10). ${keyInsight}. ${topPriority ? `For tomorrow, the most important thing is: ${topPriority}` : ""} This plan is built on your actual data — not generic advice.`;
}

export default router;
