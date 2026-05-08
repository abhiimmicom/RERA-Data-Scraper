import { Router, type IRouter } from "express";
import { db, agentsTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { runScraper, getScraperState } from "../lib/scraper";

const router: IRouter = Router();

router.post("/scraper/run", async (req, res): Promise<void> => {
  const maxAgents = req.query.maxAgents ? parseInt(String(req.query.maxAgents), 10) : 0;
  const result = await runScraper(isNaN(maxAgents) ? 0 : maxAgents);
  res.json(result);
});

router.get("/scraper/status", async (_req, res): Promise<void> => {
  const state = getScraperState();
  const totalResult = await db.select({ count: count() }).from(agentsTable);
  const total = Number(totalResult[0]?.count ?? 0);

  res.json({
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    totalAgents: total,
    isRunning: state.isRunning,
  });
});

export default router;
