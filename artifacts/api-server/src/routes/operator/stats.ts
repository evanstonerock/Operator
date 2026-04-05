import { Router } from "express";
import { db, endOfDayReviewsTable, preDayPlansTable, preWeekPlansTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router = Router();

// GET /api/operator/stats
router.get("/stats", async (req, res) => {
  try {
    const [eodStats] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(endOfDayReviewsTable);

    const [dayPlanStats] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(preDayPlansTable);

    const [weekPlanStats] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(preWeekPlansTable);

    const [lastEod] = await db
      .select({ date: endOfDayReviewsTable.date })
      .from(endOfDayReviewsTable)
      .orderBy(desc(endOfDayReviewsTable.createdAt))
      .limit(1);

    const [lastDayPlan] = await db
      .select({ date: preDayPlansTable.date })
      .from(preDayPlansTable)
      .orderBy(desc(preDayPlansTable.createdAt))
      .limit(1);

    const [lastWeekPlan] = await db
      .select({ date: preWeekPlansTable.weekStartDate })
      .from(preWeekPlansTable)
      .orderBy(desc(preWeekPlansTable.createdAt))
      .limit(1);

    // Calculate streak from EOD reviews
    const recentEod = await db
      .select({ date: endOfDayReviewsTable.date })
      .from(endOfDayReviewsTable)
      .orderBy(desc(endOfDayReviewsTable.createdAt))
      .limit(30);

    let streakDays = 0;
    if (recentEod.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dates = recentEod.map(c => {
        const d = new Date(c.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });
      const uniqueDates = [...new Set(dates)].sort((a, b) => b - a);

      let current = today.getTime();
      for (const d of uniqueDates) {
        if (d === current || d === current - 86400000) {
          streakDays++;
          current = d - 86400000;
        } else {
          break;
        }
      }
    }

    res.json({
      totalEodReviews: eodStats?.total ?? 0,
      totalDayPlans: dayPlanStats?.total ?? 0,
      totalWeekPlans: weekPlanStats?.total ?? 0,
      lastEodDate: lastEod?.date ?? null,
      lastDayPlanDate: lastDayPlan?.date ?? null,
      lastWeekPlanDate: lastWeekPlan?.date ?? null,
      streakDays,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get operator stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
