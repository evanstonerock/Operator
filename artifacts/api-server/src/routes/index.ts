import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyCheckinsRouter from "./operator/daily-checkins";
import weeklyReviewsRouter from "./operator/weekly-reviews";
import statsRouter from "./operator/stats";
import metricsRouter from "./operator/metrics";
import metricLogsRouter from "./operator/metric-logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/daily-checkins", dailyCheckinsRouter);
router.use("/weekly-reviews", weeklyReviewsRouter);
router.use("/operator", statsRouter);
router.use("/metrics", metricsRouter);
router.use("/metric-logs", metricLogsRouter);

export default router;
