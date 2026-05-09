import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import scraperRouter from "./scraper";
import recaMembersRouter from "./reca-members";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(scraperRouter);
router.use(recaMembersRouter);

export default router;
