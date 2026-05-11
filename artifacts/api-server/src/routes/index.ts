import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import scraperRouter from "./scraper";
import recaMembersRouter from "./reca-members";
import propzRouter from "./propz";
import rivirtualRouter from "./rivirtual";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(scraperRouter);
router.use(recaMembersRouter);
router.use(propzRouter);
router.use(rivirtualRouter);

export default router;
