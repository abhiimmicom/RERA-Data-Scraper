import { Router, type IRouter } from "express";
import { db, agentsTable } from "@workspace/db";
import { ilike, or, sql, count, eq } from "drizzle-orm";
import {
  ListAgentsQueryParams,
  GetAgentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/agents/stats", async (_req, res): Promise<void> => {
  const totalResult = await db.select({ count: count() }).from(agentsTable);
  const total = totalResult[0]?.count ?? 0;

  const individualsResult = await db
    .select({ count: count() })
    .from(agentsTable)
    .where(ilike(agentsTable.agentType, "%individual%"));
  const individuals = individualsResult[0]?.count ?? 0;

  const companiesResult = await db
    .select({ count: count() })
    .from(agentsTable)
    .where(or(
      ilike(agentsTable.agentType, "%company%"),
      ilike(agentsTable.agentType, "%other%"),
    ));
  const companies = companiesResult[0]?.count ?? 0;

  const now = new Date();
  const currentYear = now.getFullYear();

  const allAgents = await db.select({ validUntil: agentsTable.validUntil }).from(agentsTable);
  let expired = 0;
  let active = 0;
  let lastScrapedAt: string | null = null;

  for (const agent of allAgents) {
    if (!agent.validUntil) continue;
    const parts = agent.validUntil.split("/");
    if (parts.length === 3) {
      const year = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[0], 10);
      const expiry = new Date(year, month, day);
      if (expiry < now) {
        expired++;
      } else {
        active++;
      }
    }
  }

  const lastScrapedResult = await db
    .select({ scrapedAt: agentsTable.scrapedAt })
    .from(agentsTable)
    .orderBy(sql`${agentsTable.scrapedAt} DESC`)
    .limit(1);

  if (lastScrapedResult.length > 0) {
    lastScrapedAt = lastScrapedResult[0].scrapedAt.toISOString();
  }

  res.json({
    total: Number(total),
    individuals: Number(individuals),
    companies: Number(companies),
    expired,
    active,
    lastScrapedAt,
  });
});

router.get("/agents", async (req, res): Promise<void> => {
  const parsed = ListAgentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, agentType, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  let query = db.select().from(agentsTable).$dynamic();
  let countQuery = db.select({ count: count() }).from(agentsTable).$dynamic();

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(agentsTable.name, `%${search}%`),
        ilike(agentsTable.registrationNo, `%${search}%`),
        ilike(agentsTable.emailId, `%${search}%`),
        ilike(agentsTable.phoneNumber, `%${search}%`),
        ilike(agentsTable.registeredAddress, `%${search}%`),
        ilike(agentsTable.personName, `%${search}%`),
      ),
    );
  }

  if (agentType && agentType !== "all") {
    conditions.push(ilike(agentsTable.agentType, `%${agentType}%`));
  }

  if (conditions.length > 0) {
    const whereClause = conditions.length === 1 ? conditions[0]! : or(...conditions.map(c => c!))!;
    query = query.where(whereClause);
    countQuery = countQuery.where(whereClause);
  }

  const [agents, totalResult] = await Promise.all([
    query
      .orderBy(sql`${agentsTable.serialNumber} ASC NULLS LAST`)
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

router.get("/agents/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetAgentParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, parsed.data.id));

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
