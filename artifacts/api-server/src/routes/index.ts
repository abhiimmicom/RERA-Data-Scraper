import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import scraperRouter from "./scraper";
import recaMembersRouter from "./reca-members";
import propzRouter from "./propz";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(scraperRouter);
router.use(recaMembersRouter);
router.use(propzRouter);

export default router;
