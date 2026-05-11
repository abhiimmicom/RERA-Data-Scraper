import { Router, type IRouter } from "express";
import { db, propzJobsTable, propzAgentsTable } from "@workspace/db";
import { eq, ilike, or, sql, count, and, desc } from "drizzle-orm";
import { runPropzJob } from "../lib/propz-scraper";

const router: IRouter = Router();

router.post("/propz/jobs", async (req, res): Promise<void> => {
  const { url, label, fetchDetails } = req.body as {
    url?: string;
    label?: string;
    fetchDetails?: boolean;
  };

  if (!url || !label) {
    res.status(400).json({ error: "url and label are required" });
    return;
  }

  const [job] = await db
    .insert(propzJobsTable)
    .values({
      url: url.trim(),
      label: label.trim(),
      status: "pending",
      fetchDetails: fetchDetails === true,
    })
    .returning();

  if (!job) {
    res.status(500).json({ error: "Failed to create job" });
    return;
  }

  setImmediate(() => {
    runPropzJob(job.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      db.update(propzJobsTable)
        .set({ status: "failed", error: msg })
        .where(eq(propzJobsTable.id, job.id))
        .catch(() => undefined);
    });
  });

  res.json({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
});

router.get("/propz/jobs", async (_req, res): Promise<void> => {
  const jobs = await db
    .select()
    .from(propzJobsTable)
    .orderBy(desc(propzJobsTable.createdAt));

  res.json({
    jobs: jobs.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
  });
});

router.delete("/propz/jobs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db.delete(propzAgentsTable).where(eq(propzAgentsTable.jobId, id));
  await db.delete(propzJobsTable).where(eq(propzJobsTable.id, id));

  res.json({ success: true });
});

router.get("/propz/agents", async (req, res): Promise<void> => {
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

  let query = db.select().from(propzAgentsTable).$dynamic();
  let countQuery = db
    .select({ count: count() })
    .from(propzAgentsTable)
    .$dynamic();

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(propzAgentsTable.name, `%${search}%`),
        ilike(propzAgentsTable.reraId, `%${search}%`),
        ilike(propzAgentsTable.mobile, `%${search}%`),
        ilike(propzAgentsTable.email, `%${search}%`),
        ilike(propzAgentsTable.label, `%${search}%`),
      )!,
    );
  }

  if (jobId !== undefined && !isNaN(jobId)) {
    conditions.push(eq(propzAgentsTable.jobId, jobId));
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
      .orderBy(sql`${propzAgentsTable.id} ASC`)
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

router.get("/propz/agents/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [agent] = await db
    .select()
    .from(propzAgentsTable)
    .where(eq(propzAgentsTable.id, id));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json({
    ...agent,
    scrapedAt: agent.scrapedAt.toISOString(),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  });
});

export default router;
