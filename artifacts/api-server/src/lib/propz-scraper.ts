import axios from "axios";
import * as cheerio from "cheerio";
import { db, propzJobsTable, propzAgentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function decodeCfEmail(encoded: string): string {
  if (!encoded || encoded.length < 4) return "";
  const r = parseInt(encoded.substring(0, 2), 16);
  let email = "";
  for (let i = 2; i < encoded.length; i += 2) {
    email += String.fromCharCode(parseInt(encoded.substring(i, i + 2), 16) ^ r);
  }
  return email;
}

function detectMaxPage(html: string): number {
  const $ = cheerio.load(html);
  let maxPage = 1;
  $("a[href*='/page/']").each((_, el) => {
    const match = $(el).attr("href")?.match(/\/page\/(\d+)\//);
    if (match) {
      const p = parseInt(match[1]!, 10);
      if (p > maxPage) maxPage = p;
    }
  });
  return maxPage;
}

function extractAgentsFromPage(
  html: string,
  label: string,
  jobId: number,
): Array<typeof propzAgentsTable.$inferInsert> {
  const $ = cheerio.load(html);
  const agents: Array<typeof propzAgentsTable.$inferInsert> = [];

  $("article.agent-list-wrap").each((_, el) => {
    const photoUrl =
      $(el).find("meta[itemprop='image']").attr("content") || null;

    const nameRaw = $(el).find("a[itemprop='name']").text().trim();
    if (!nameRaw) return;

    const reraMatch = nameRaw.match(/\(([^)]+)\)\s*$/);
    const reraId = reraMatch ? reraMatch[1]!.trim() : null;
    const name = nameRaw.replace(/\s*\([^)]*\)\s*$/, "").trim() || nameRaw;

    const designation =
      $(el).find("span[itemprop='jobTitle']").text().trim() || null;

    const mobileRaw = $(el).find("dd.agent-phone a").text().trim();
    const mobile = mobileRaw || null;

    const cfEl = $(el).find("[data-cfemail]");
    const cfCode = cfEl.attr("data-cfemail") ?? "";
    const email = cfCode ? decodeCfEmail(cfCode) || null : null;

    const whatsappHref = $(el).find("a.btn-whatsapp").attr("href") ?? "";
    const whatsapp = whatsappHref.replace("https://wa.me/", "") || null;

    const detailUrl = $(el).find("a[itemprop='url']").attr("href") || null;

    agents.push({
      jobId,
      label,
      name,
      reraId,
      designation,
      photoUrl,
      mobile,
      email,
      whatsapp,
      detailUrl,
      scrapedAt: new Date(),
    });
  });

  return agents;
}

async function fetchDetailBio(url: string): Promise<string | null> {
  try {
    const resp = await axios.get<string>(url, {
      headers: HEADERS,
      timeout: 15000,
    });
    const $ = cheerio.load(resp.data);
    const bio = $(".agent-bio-wrap p").first().text().trim();
    return bio || null;
  } catch {
    return null;
  }
}

export async function runPropzJob(jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(propzJobsTable)
    .where(eq(propzJobsTable.id, jobId));
  if (!job) return;

  try {
    await db
      .update(propzJobsTable)
      .set({ status: "running", pagesScraped: 0, agentsFound: 0 })
      .where(eq(propzJobsTable.id, jobId));

    const resp1 = await axios.get<string>(job.url, {
      headers: HEADERS,
      timeout: 20000,
    });
    const maxPage = detectMaxPage(resp1.data);

    await db
      .update(propzJobsTable)
      .set({ totalPages: maxPage })
      .where(eq(propzJobsTable.id, jobId));

    let totalAgents = 0;

    const agents1 = extractAgentsFromPage(resp1.data, job.label, jobId);
    if (agents1.length > 0) {
      await db.insert(propzAgentsTable).values(agents1);
      totalAgents += agents1.length;
    }
    await db
      .update(propzJobsTable)
      .set({ pagesScraped: 1, agentsFound: totalAgents })
      .where(eq(propzJobsTable.id, jobId));

    for (let page = 2; page <= maxPage; page++) {
      await sleep(800);

      const baseUrl = job.url.replace(/\/$/, "");
      const pageUrl = `${baseUrl}/page/${page}/`;

      const resp = await axios.get<string>(pageUrl, {
        headers: HEADERS,
        timeout: 20000,
      });
      const agents = extractAgentsFromPage(resp.data, job.label, jobId);

      if (agents.length > 0) {
        await db.insert(propzAgentsTable).values(agents);
        totalAgents += agents.length;
      }

      await db
        .update(propzJobsTable)
        .set({ pagesScraped: page, agentsFound: totalAgents })
        .where(eq(propzJobsTable.id, jobId));
    }

    if (job.fetchDetails) {
      const allAgents = await db
        .select()
        .from(propzAgentsTable)
        .where(eq(propzAgentsTable.jobId, jobId));

      for (const agent of allAgents) {
        if (!agent.detailUrl) continue;
        await sleep(600);
        const bio = await fetchDetailBio(agent.detailUrl);
        if (bio) {
          await db
            .update(propzAgentsTable)
            .set({ bio })
            .where(eq(propzAgentsTable.id, agent.id));
        }
      }
    }

    await db
      .update(propzJobsTable)
      .set({ status: "done", agentsFound: totalAgents })
      .where(eq(propzJobsTable.id, jobId));

    logger.info({ jobId, totalAgents }, "Propz scrape job complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ jobId, err }, "Propz scrape job failed");
    await db
      .update(propzJobsTable)
      .set({ status: "failed", error: message })
      .where(eq(propzJobsTable.id, jobId));
  }
}
