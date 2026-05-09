import { Router, type IRouter } from "express";
import { db, recaMembersTable } from "@workspace/db";
import { ilike, or, sql, count, eq } from "drizzle-orm";
import { scrapeRecaMembers, getRecaScraperState } from "../lib/reca-scraper";

const router: IRouter = Router();

router.get("/reca-members/scrape/status", async (_req, res): Promise<void> => {
  const { isRunning, lastRunAt } = getRecaScraperState();
  const totalResult = await db.select({ count: count() }).from(recaMembersTable);
  res.json({
    isRunning,
    lastRunAt: lastRunAt?.toISOString() ?? null,
    totalMembers: Number(totalResult[0]?.count ?? 0),
  });
});

router.post("/reca-members/scrape", async (_req, res): Promise<void> => {
  const result = await scrapeRecaMembers();
  res.json(result);
});

router.get("/reca-members", async (req, res): Promise<void> => {
  const search = typeof req.query["search"] === "string" ? req.query["search"] : undefined;
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;

  let query = db.select().from(recaMembersTable).$dynamic();
  let countQuery = db.select({ count: count() }).from(recaMembersTable).$dynamic();

  if (search) {
    const cond = or(
      ilike(recaMembersTable.name, `%${search}%`),
      ilike(recaMembersTable.companyName, `%${search}%`),
      ilike(recaMembersTable.membershipId, `%${search}%`),
      ilike(recaMembersTable.email, `%${search}%`),
      ilike(recaMembersTable.mobileNo, `%${search}%`),
      ilike(recaMembersTable.city, `%${search}%`),
      ilike(recaMembersTable.reraNo, `%${search}%`),
    )!;
    query = query.where(cond);
    countQuery = countQuery.where(cond);
  }

  const [members, totalResult] = await Promise.all([
    query
      .orderBy(sql`${recaMembersTable.membershipId} ASC NULLS LAST`)
      .limit(limit)
      .offset(offset),
    countQuery,
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  res.json({
    members: members.map((m) => ({
      ...m,
      scrapedAt: m.scrapedAt.toISOString(),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

router.get("/reca-members/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [member] = await db
    .select()
    .from(recaMembersTable)
    .where(eq(recaMembersTable.id, id));

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.json({
    ...member,
    scrapedAt: member.scrapedAt.toISOString(),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  });
});

export default router;
