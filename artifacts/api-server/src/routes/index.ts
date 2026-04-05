import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eodReviewsRouter from "./operator/eod-reviews";
import preDayPlansRouter from "./operator/pre-day-plans";
import preWeekPlansRouter from "./operator/pre-week-plans";
import statsRouter from "./operator/stats";
import metricsRouter from "./operator/metrics";
import metricLogsRouter from "./operator/metric-logs";
import dailyCheckinsRouter from "./operator/daily-checkins";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/metrics", metricsRouter);
router.use("/metric-logs", metricLogsRouter);
router.use("/daily-checkins", dailyCheckinsRouter);
router.use("/eod-reviews", eodReviewsRouter);
router.use("/pre-day-plans", preDayPlansRouter);
router.use("/pre-week-plans", preWeekPlansRouter);
router.use("/operator", statsRouter);

export default router;