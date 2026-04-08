import { Router } from "express";
import { db, dailyCheckinsTable, metricLogsTable, metricsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { CreateDailyCheckinBody } from "@workspace/api-zod";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

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

    const daySummary = await buildStructuredDaySummary({
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
    });

    // Step 1: Claude reflection using the structured day summary
    let claudeReflection = "";
    try {
      const anthropicClient = getAnthropicClient();
      if (!anthropicClient) {
        throw new Error("ANTHROPIC_API_KEY is not configured");
      }

      const claudeMsg = await anthropicClient.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a thoughtful personal coach reviewing one specific day. Use the structured summary below to produce a deeper reflection that is specific, honest, and useful.

${daySummary.promptContext}

Write plain text with short readable paragraphs. Cover:
1. What today’s data and reflections actually say
2. The most meaningful patterns or tensions across energy, focus, mood, health, sleep, tasks, and tracked metrics
3. Where the user’s subjective reflection matches or conflicts with the metrics
4. The one or two most important insights this person should carry forward

Reference concrete values, targets, and reflection details where possible. Avoid generic self-help language.`,
          },
        ],
      });
      claudeReflection = claudeMsg.content
        .filter((block) => block.type === "text")
        .map((block) => block.text.trim())
        .join("\n\n")
        .trim();

      if (!claudeReflection) {
        throw new Error("Claude returned an empty reflection");
      }
    } catch (err) {
      req.log.error({ err }, "Claude reflection failed");
      claudeReflection = buildReflectionFallback(daySummary.summaryText);
    }

    // Step 2: OpenAI tomorrow plan
    let openaiPlan = "";
    try {
      const openaiClient = getOpenAIClient();
      if (!openaiClient) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const planResponse = await openaiClient.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a practical planner turning today’s results into a better tomorrow. Build a simple, concrete plan from the day summary and reflection below.

DAY SUMMARY:
${daySummary.promptContext}

DEEPER REFLECTION:
${claudeReflection}

Respond in plain text with exactly these sections:

TOP PRIORITY:
[One sentence]

3 KEY ACTIONS:
1. [Specific action]
2. [Specific action]
3. [Specific action]

SUGGESTED FOCUS AREAS:
[Short paragraph]

ONE THING TO AVOID:
[One sentence]

IDEAL APPROACH FOR TOMORROW:
[One sentence]

Make the actions realistic and tied to the user’s actual metrics, reflections, and task patterns.`,
          },
        ],
      });
      openaiPlan = planResponse.choices[0]?.message?.content?.trim() ?? "";

      if (!openaiPlan) {
        throw new Error("OpenAI returned an empty plan");
      }
    } catch (err) {
      req.log.error({ err }, "OpenAI planning failed");
      openaiPlan = buildPlanFallback(daySummary.summaryText);
    }

    // Step 3: Combined advice
    const combinedAdvice = buildCombinedDailyAdvice({
      summaryText: daySummary.summaryText,
      claudeReflection,
      openaiPlan,
    });

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

function buildCombinedDailyAdvice({
  summaryText,
  claudeReflection,
  openaiPlan,
}: {
  summaryText: string;
  claudeReflection: string;
  openaiPlan: string;
}): string {
  const summarySignal = summaryText
    .split("\n")
    .find((line) => line.startsWith("Energy:") || line.startsWith("Focus:") || line.startsWith("Mood:"));
  const reflectionSnippet = claudeReflection.split(/\.\s+/).find((sentence) => sentence.length > 40)?.trim()
    ?? claudeReflection.slice(0, 220).trim();
  const topPriorityMatch = openaiPlan.match(/TOP PRIORITY:\s*\n?(.*?)(?:\n|$)/i);
  const topPriority = topPriorityMatch?.[1]?.trim();

  return [
    summarySignal ? `Day signal: ${summarySignal}` : null,
    reflectionSnippet ? `Reflection: ${reflectionSnippet}` : null,
    topPriority ? `Tomorrow's priority: ${topPriority}` : null,
  ].filter(Boolean).join(" ");
}

export default router;

type StructuredDaySummaryInput = {
  date: string;
  notes: string;
  energyLevel: number;
  focusLevel: number;
  healthLevel: number;
  sleepQuality: number;
  mood: number;
  tasksCompleted: string;
  tasksMissed: string;
  habitsCompleted?: string | null;
  symptomsNotes?: string | null;
  reflectionFeltGood?: string | null;
  reflectionFeltOff?: string | null;
  reflectionGotInWay?: string | null;
  reflectionAnythingUnusual?: string | null;
};

type StructuredMetric = typeof metricsTable.$inferSelect & {
  loggedValue: string | null;
};

type StructuredDaySummary = {
  summaryText: string;
  promptContext: string;
};

let openaiClient: OpenAI | null | undefined;
let anthropicClient: Anthropic | null | undefined;

async function buildStructuredDaySummary(input: StructuredDaySummaryInput): Promise<StructuredDaySummary> {
  let metrics: StructuredMetric[] = [];

  try {
    const [definitions, logs] = await Promise.all([
      db
        .select()
        .from(metricsTable)
        .where(eq(metricsTable.isActive, true))
        .orderBy(metricsTable.displayOrder, metricsTable.sortOrder, metricsTable.id),
      db
        .select({
          metricId: metricLogsTable.metricId,
          value: metricLogsTable.value,
        })
        .from(metricLogsTable)
        .where(and(eq(metricLogsTable.date, input.date))),
    ]);

    const logMap = new Map(logs.map((log) => [log.metricId, log.value]));
    metrics = definitions.map((metric) => ({
      ...metric,
      loggedValue: logMap.get(metric.id) ?? null,
    }));
  } catch {
    metrics = [];
  }

  const reflectionItems = [
    input.reflectionFeltGood ? `Felt good: ${input.reflectionFeltGood}` : null,
    input.reflectionFeltOff ? `Felt off: ${input.reflectionFeltOff}` : null,
    input.reflectionGotInWay ? `Got in the way: ${input.reflectionGotInWay}` : null,
    input.reflectionAnythingUnusual ? `Anything unusual: ${input.reflectionAnythingUnusual}` : null,
  ].filter(Boolean) as string[];

  const metricDefinitionLines = metrics.length > 0
    ? metrics.map((metric) => {
        const parts = [
          `${metric.name} [${metric.category}/${metric.type}]`,
          metric.unit ? `unit=${metric.unit}` : null,
          metric.targetValue ? `target=${metric.targetValue}` : null,
          metric.aiContext ? `context=${metric.aiContext}` : null,
        ].filter(Boolean);
        return `- ${parts.join(", ")}`;
      }).join("\n")
    : "- No active metric definitions found";

  const loggedMetricLines = metrics.filter((metric) => metric.loggedValue != null).length > 0
    ? metrics
        .filter((metric) => metric.loggedValue != null)
        .map((metric) => {
          const targetText = metric.targetValue ? `, target=${metric.targetValue}` : "";
          const unitText = metric.unit ? ` ${metric.unit}` : "";
          return `- ${metric.name}: ${metric.loggedValue}${unitText}${targetText}`;
        })
        .join("\n")
    : "- No metric logs found for this date";

  const scoreLines = [
    `Energy: ${input.energyLevel}/10`,
    `Focus: ${input.focusLevel}/10`,
    `Health: ${input.healthLevel}/10`,
    `Sleep quality: ${input.sleepQuality}/10`,
    `Mood: ${input.mood}/10`,
  ].join("\n");

  const summarySections = [
    `DATE\n${input.date}`,
    `CORE SCORES\n${scoreLines}`,
    `TASKS\nCompleted: ${input.tasksCompleted}\nMissed: ${input.tasksMissed}`,
    `NOTES\n${input.notes}`,
    input.habitsCompleted ? `HABITS\n${input.habitsCompleted}` : null,
    input.symptomsNotes ? `SYMPTOMS\n${input.symptomsNotes}` : null,
    `METRIC DEFINITIONS\n${metricDefinitionLines}`,
    `TODAY'S METRIC LOGS\n${loggedMetricLines}`,
    reflectionItems.length > 0 ? `REFLECTION INPUTS\n${reflectionItems.join("\n")}` : "REFLECTION INPUTS\n- None provided",
  ].filter(Boolean);

  const summaryText = summarySections.join("\n\n");

  return {
    summaryText,
    promptContext: `${summaryText}\n\nDAY TAKEAWAY\nThis summary combines the user's manual check-in, today's metric logs, active metric definitions, and reflection inputs.`,
  };
}

function getOpenAIClient(): OpenAI | null {
  if (openaiClient !== undefined) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    openaiClient = null;
    return openaiClient;
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

function getAnthropicClient(): Anthropic | null {
  if (anthropicClient !== undefined) {
    return anthropicClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    anthropicClient = null;
    return anthropicClient;
  }

  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

function buildReflectionFallback(summaryText: string): string {
  const compactSummary = summaryText.split("\n").slice(0, 12).join(" ").trim();
  return `Claude reflection unavailable. The day summary still shows the main signals: ${compactSummary}`;
}

function buildPlanFallback(summaryText: string): string {
  const shortSummary = summaryText.split("\n").slice(0, 10).join(" ").trim();
  return [
    "TOP PRIORITY:",
    "Review today’s strongest and weakest signals before starting tomorrow.",
    "",
    "3 KEY ACTIONS:",
    "1. Repeat the behaviors that supported your better scores and completed tasks.",
    "2. Reduce the main friction point mentioned in your reflection before it compounds tomorrow.",
    "3. Check your most important metrics early so you can adjust sooner.",
    "",
    "SUGGESTED FOCUS AREAS:",
    `Base tomorrow on this summary: ${shortSummary}`,
    "",
    "ONE THING TO AVOID:",
    "Avoid carrying today’s missed-task pattern forward without adjusting the plan.",
    "",
    "IDEAL APPROACH FOR TOMORROW:",
    "Keep tomorrow simple, measurable, and grounded in your actual data.",
  ].join("\n");
}