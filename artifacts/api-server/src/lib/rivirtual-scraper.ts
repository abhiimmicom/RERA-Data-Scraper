import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { db, rivirtualJobsTable, rivirtualAgentsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

const IMAGES_DIR = path.resolve(process.cwd(), "public/images/rivirtual");

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

function slugFromUrl(url: string): string {
  return url.replace(/\/$/, "").split("/").pop() ?? "";
}

function cityFromSlug(slug: string): string {
  const parts = slug.split("-");
  return parts[parts.length - 1] ?? "";
}

function extFromUrl(url: string): string {
  const clean = url.split("?")[0] ?? "";
  const match = clean.match(/\.(png|jpg|jpeg|gif|webp)$/i);
  return match ? match[0].toLowerCase() : ".jpg";
}

async function downloadImage(
  remoteUrl: string,
  slug: string,
): Promise<string | null> {
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    const ext = extFromUrl(remoteUrl);
    const filename = `${slug}${ext}`;
    const localFile = path.join(IMAGES_DIR, filename);

    if (fs.existsSync(localFile)) {
      return `/api/images/rivirtual/${filename}`;
    }

    const resp = await axios.get<Buffer>(remoteUrl, {
      responseType: "arraybuffer",
      headers: HEADERS,
      timeout: 15000,
    });

    fs.writeFileSync(localFile, resp.data);
    return `/api/images/rivirtual/${filename}`;
  } catch {
    return null;
  }
}

interface ProfileRef {
  url: string;
  slug: string;
}

function extractProfileLinks(html: string): ProfileRef[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const refs: ProfileRef[] = [];

  $("a[href*='realtors-public-profile']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || seen.has(href)) return;
    seen.add(href);
    const slug = slugFromUrl(href);
    refs.push({ url: href, slug });
  });

  return refs;
}

function detectMaxPage(html: string): number {
  const $ = cheerio.load(html);
  let maxPage = 1;
  $("a.page-link[href*='?page=']").each((_, el) => {
    const match = $(el).attr("href")?.match(/[?&]page=(\d+)/);
    if (match) {
      const p = parseInt(match[1]!, 10);
      if (p > maxPage) maxPage = p;
    }
  });
  return maxPage;
}

async function isJobStillRunning(jobId: number): Promise<boolean> {
  const [job] = await db
    .select({ status: rivirtualJobsTable.status })
    .from(rivirtualJobsTable)
    .where(eq(rivirtualJobsTable.id, jobId));
  return job?.status === "running";
}

async function fetchAgentDetail(
  profileUrl: string,
  label: string,
  jobId: number,
): Promise<typeof rivirtualAgentsTable.$inferInsert | null> {
  try {
    const resp = await axios.get<string>(profileUrl, {
      headers: HEADERS,
      timeout: 20000,
    });
    const $ = cheerio.load(resp.data);
    const panel = $(".agent_publick_left_inr").first();
    if (!panel.length) return null;

    const name = panel.find("h1").first().text().trim();
    if (!name) return null;

    const slug = slugFromUrl(profileUrl);
    const city = cityFromSlug(slug);

    const remotePhotoUrl = panel.find(".agent_publick_det img").attr("src") ?? null;

    let photoUrl: string | null = null;
    if (remotePhotoUrl) {
      photoUrl = await downloadImage(remotePhotoUrl, slug);
    }

    const cfEl = panel.find("[data-cfemail]").first();
    const cfCode = cfEl.attr("data-cfemail") ?? "";
    const email = cfCode ? decodeCfEmail(cfCode) || null : null;

    const phone =
      panel.find(".show_contact_02 a").first().text().trim() || null;

    let propertyType: string | null = null;
    panel.find("h5").each((_, el) => {
      const text = $(el).text();
      if (text.includes("Property Type")) {
        propertyType = text.replace("Property Type", "").replace(":", "").trim() || null;
      }
    });

    return {
      slug,
      jobId,
      label,
      name,
      email,
      phone,
      propertyType,
      photoUrl,
      remotePhotoUrl,
      detailUrl: profileUrl,
      city,
      scrapedAt: new Date(),
    };
  } catch {
    return null;
  }
}

export async function runRivirtualJob(jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(rivirtualJobsTable)
    .where(eq(rivirtualJobsTable.id, jobId));
  if (!job) return;

  try {
    await db
      .update(rivirtualJobsTable)
      .set({ status: "running", pagesScraped: 0, agentsFound: 0 })
      .where(eq(rivirtualJobsTable.id, jobId));

    const resp1 = await axios.get<string>(job.url, {
      headers: HEADERS,
      timeout: 20000,
    });

    const maxPageFromSite = detectMaxPage(resp1.data);
    const actualMax =
      job.maxPages && job.maxPages > 0
        ? Math.min(maxPageFromSite, job.maxPages)
        : maxPageFromSite;

    await db
      .update(rivirtualJobsTable)
      .set({ totalPages: actualMax })
      .where(eq(rivirtualJobsTable.id, jobId));

    let totalAgents = 0;

    const processPage = async (html: string, pageNum: number): Promise<boolean> => {
      // Check cancellation before processing each page
      if (!(await isJobStillRunning(jobId))) return false;

      const profiles = extractProfileLinks(html);
      let inserted = 0;

      // Find which slugs from this page already exist in the DB — skip those
      const pageSlugs = profiles.map((p) => p.slug).filter(Boolean);
      const existingSlugs = new Set<string>();
      if (pageSlugs.length > 0) {
        const existing = await db
          .select({ slug: rivirtualAgentsTable.slug })
          .from(rivirtualAgentsTable)
          .where(inArray(rivirtualAgentsTable.slug, pageSlugs));
        for (const row of existing) existingSlugs.add(row.slug);
      }

      for (const profile of profiles) {
        // Check cancellation between each profile fetch
        if (!(await isJobStillRunning(jobId))) return false;

        if (existingSlugs.has(profile.slug)) {
          // Already scraped — count it but skip the network fetch
          inserted++;
          continue;
        }

        await sleep(700);
        const agent = await fetchAgentDetail(profile.url, job.label, jobId);
        if (!agent) continue;

        await db
          .insert(rivirtualAgentsTable)
          .values(agent)
          .onConflictDoUpdate({
            target: rivirtualAgentsTable.slug,
            set: {
              name: agent.name,
              email: agent.email,
              phone: agent.phone,
              propertyType: agent.propertyType,
              photoUrl: agent.photoUrl,
              remotePhotoUrl: agent.remotePhotoUrl,
              city: agent.city,
              label: agent.label,
              jobId: agent.jobId,
              scrapedAt: agent.scrapedAt,
            },
          });
        inserted++;
      }

      totalAgents += inserted;
      await db
        .update(rivirtualJobsTable)
        .set({ pagesScraped: pageNum, agentsFound: totalAgents })
        .where(eq(rivirtualJobsTable.id, jobId));

      return true;
    };

    const ok = await processPage(resp1.data, 1);
    if (!ok) {
      logger.info({ jobId }, "Rivirtual job cancelled");
      return;
    }

    const baseUrl = job.url.replace(/[?#].*$/, "");

    for (let page = 2; page <= actualMax; page++) {
      await sleep(1000);
      const pageUrl = `${baseUrl}?page=${page}`;
      const resp = await axios.get<string>(pageUrl, {
        headers: HEADERS,
        timeout: 20000,
      });
      const ok = await processPage(resp.data, page);
      if (!ok) {
        logger.info({ jobId }, "Rivirtual job cancelled");
        return;
      }
    }

    await db
      .update(rivirtualJobsTable)
      .set({ status: "done", agentsFound: totalAgents })
      .where(eq(rivirtualJobsTable.id, jobId));

    logger.info({ jobId, totalAgents }, "Rivirtual scrape job complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ jobId, err }, "Rivirtual scrape job failed");
    await db
      .update(rivirtualJobsTable)
      .set({ status: "failed", error: message })
      .where(eq(rivirtualJobsTable.id, jobId));
  }
}
