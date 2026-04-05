import { Router } from "express";
import { db, dailyCheckinsTable, weeklyReviewsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router = Router();

// GET /api/operator/stats
router.get("/stats", async (req, res) => {
  try {
    const [checkinStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        avgEnergy: sql<number>`avg(energy_level)::float`,
        avgFocus: sql<number>`avg(focus_level)::float`,
        avgMood: sql<number>`avg(mood)::float`,
        avgSleep: sql<number>`avg(sleep_quality)::float`,
        avgHealth: sql<number>`avg(health_level)::float`,
      })
      .from(dailyCheckinsTable);

    const [weeklyStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(weeklyReviewsTable);

    const [lastCheckin] = await db
      .select({ date: dailyCheckinsTable.createdAt })
      .from(dailyCheckinsTable)
      .orderBy(desc(dailyCheckinsTable.createdAt))
      .limit(1);

    const [lastWeekly] = await db
      .select({ date: weeklyReviewsTable.createdAt })
      .from(weeklyReviewsTable)
      .orderBy(desc(weeklyReviewsTable.createdAt))
      .limit(1);

    // Calculate streak: consecutive days with check-ins
    const recentCheckins = await db
      .select({ date: dailyCheckinsTable.date })
      .from(dailyCheckinsTable)
      .orderBy(desc(dailyCheckinsTable.createdAt))
      .limit(30);

    let streakDays = 0;
    if (recentCheckins.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dates = recentCheckins.map(c => {
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
      totalCheckins: checkinStats?.total ?? 0,
      totalWeeklyReviews: weeklyStats?.total ?? 0,
      avgEnergy: checkinStats?.avgEnergy ? Math.round(checkinStats.avgEnergy * 10) / 10 : null,
      avgFocus: checkinStats?.avgFocus ? Math.round(checkinStats.avgFocus * 10) / 10 : null,
      avgMood: checkinStats?.avgMood ? Math.round(checkinStats.avgMood * 10) / 10 : null,
      avgSleep: checkinStats?.avgSleep ? Math.round(checkinStats.avgSleep * 10) / 10 : null,
      avgHealth: checkinStats?.avgHealth ? Math.round(checkinStats.avgHealth * 10) / 10 : null,
      lastCheckinDate: lastCheckin?.date ? lastCheckin.date.toISOString() : null,
      lastWeeklyReviewDate: lastWeekly?.date ? lastWeekly.date.toISOString() : null,
      streakDays,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get operator stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/operator/trends
router.get("/trends", async (req, res) => {
  try {
    const recentCheckins = await db
      .select({
        date: dailyCheckinsTable.date,
        energy: dailyCheckinsTable.energyLevel,
        focus: dailyCheckinsTable.focusLevel,
        mood: dailyCheckinsTable.mood,
        sleep: dailyCheckinsTable.sleepQuality,
        health: dailyCheckinsTable.healthLevel,
      })
      .from(dailyCheckinsTable)
      .orderBy(desc(dailyCheckinsTable.createdAt))
      .limit(7);

    res.json(recentCheckins.reverse());
  } catch (err) {
    req.log.error({ err }, "Failed to get operator trends");
    res.status(500).json({ error: "Failed to get trends" });
  }
});

export default router;
