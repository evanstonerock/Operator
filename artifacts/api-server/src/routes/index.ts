import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyCheckinsRouter from "./operator/daily-checkins";
import weeklyReviewsRouter from "./operator/weekly-reviews";
import statsRouter from "./operator/stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/daily-checkins", dailyCheckinsRouter);
router.use("/weekly-reviews", weeklyReviewsRouter);
router.use("/operator", statsRouter);

export default router;
