import { Router, type IRouter } from "express";
import { db, rivirtualJobsTable, rivirtualAgentsTable } from "@workspace/db";
import { eq, ilike, or, sql, count, and, desc } from "drizzle-orm";
import { runRivirtualJob } from "../lib/rivirtual-scraper";

const router: IRouter = Router();

router.post("/rivirtual/jobs", async (req, res): Promise<void> => {
  const { url, label, maxPages } = req.body as {
    url?: string;
    label?: string;
    maxPages?: number;
  };

  if (!url || !label) {
    res.status(400).json({ error: "url and label are required" });
    return;
  }

  const mp =
    maxPages && Number(maxPages) > 0
      ? Math.min(9999, Number(maxPages))
      : null;

  const [job] = await db
    .insert(rivirtualJobsTable)
    .values({
      url: url.trim(),
      label: label.trim(),
      status: "pending",
      maxPages: mp,
    })
    .returning();

  if (!job) {
    res.status(500).json({ error: "Failed to create job" });
    return;
  }

  setImmediate(() => {
    runRivirtualJob(job.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      db.update(rivirtualJobsTable)
        .set({ status: "failed", error: msg })
        .where(eq(rivirtualJobsTable.id, job.id))
        .catch(() => undefined);
    });
  });

  res.json({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
});

router.get("/rivirtual/jobs", async (_req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(rivirtualJobsTable)
    .orderBy(desc(rivirtualJobsTable.createdAt));

  res.json({
    jobs: jobs.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
  });
});

router.delete("/rivirtual/jobs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const withAgents = req.query["withAgents"] === "true";

  // Mark cancelled first — the running scraper loop will see this and stop
  await db
    .update(rivirtualJobsTable)
    .set({ status: "cancelled" })
    .where(eq(rivirtualJobsTable.id, id));

  if (withAgents) {
    await db
      .delete(rivirtualAgentsTable)
      .where(eq(rivirtualAgentsTable.jobId, id));
    await db.delete(rivirtualJobsTable).where(eq(rivirtualJobsTable.id, id));
  }

  res.json({ success: true });
});

router.get("/rivirtual/agents", async (req, res): Promise<void> => {
  const search =
    typeof req.query["search"] === "string" ? req.query["search"] : undefined;
  const jobIdRaw = req.query["jobId"];
  const jobId =
    jobIdRaw !== undefined ? parseInt(String(jobIdRaw), 10) : undefined;
  const page = Math.max(
    1,
    parseInt(String(req.query["page"] ?? "1"), 10) || 1,
  );
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10) || 50),
  );
  const offset = (page - 1) * limit;

  let query = db.select().from(rivirtualAgentsTable).$dynamic();
  let countQuery = db
    .select({ count: count() })
    .from(rivirtualAgentsTable)
    .$dynamic();

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(rivirtualAgentsTable.name, `%${search}%`),
        ilike(rivirtualAgentsTable.phone, `%${search}%`),
        ilike(rivirtualAgentsTable.email, `%${search}%`),
        ilike(rivirtualAgentsTable.city, `%${search}%`),
        ilike(rivirtualAgentsTable.label, `%${search}%`),
      )!,
    );
  }

  if (jobId !== undefined && !isNaN(jobId)) {
    conditions.push(eq(rivirtualAgentsTable.jobId, jobId));
  }

  if (conditions.length > 0) {
    const whereClause =
      conditions.length === 1
        ? conditions[0]!
        : and(...conditions.map((c) => c!))!;
    query = query.where(whereClause);
    countQuery = countQuery.where(whereClause);
  }

  const [agents, totalResult] = await Promise.all([
    query
      .orderBy(sql`${rivirtualAgentsTable.id} ASC`)
      .limit(limit)
      .offset(offset),
    countQuery,
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  res.json({
    agents: agents.map((a) => ({
      ...a,
      scrapedAt: a.scrapedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export default router;
