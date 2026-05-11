import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, rivirtualJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runRivirtualJob } from "./lib/rivirtual-scraper";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const IMAGES_DIR = path.resolve(process.cwd(), "public/images");
app.use("/api/images", express.static(IMAGES_DIR));

app.use("/api", router);

// On startup, resume any jobs that were left in "running" state
// (e.g. because the server was restarted mid-scrape)
setImmediate(() => {
  db.select()
    .from(rivirtualJobsTable)
    .where(eq(rivirtualJobsTable.status, "running"))
    .then((stuckJobs) => {
      if (stuckJobs.length === 0) return;
      logger.info({ count: stuckJobs.length }, "Resuming orphaned scrape jobs");
      for (const job of stuckJobs) {
        runRivirtualJob(job.id).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          db.update(rivirtualJobsTable)
            .set({ status: "failed", error: msg })
            .where(eq(rivirtualJobsTable.id, job.id))
            .catch(() => undefined);
        });
      }
    })
    .catch((err: unknown) => {
      logger.error({ err }, "Failed to resume orphaned scrape jobs");
    });
});

export default app;
