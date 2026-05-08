import axios from "axios";
import * as cheerio from "cheerio";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const BASE_URL = "https://erera.co.in/ereradelhi/real-estate-agents/registered-real-estate-agents";

export interface ScrapeResult {
  success: boolean;
  agentsScraped: number;
  agentsInserted: number;
  agentsUpdated: number;
  message: string;
  error?: string;
}

let isRunning = false;
let lastRunAt: Date | null = null;

export function getScraperState() {
  return { isRunning, lastRunAt };
}

function parseValidUntil(text: string): string | null {
  const match = text.match(/Valid Until\s*[:：]?\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function parseRegistrationNo(text: string): string | null {
  const match = text.match(/Registration No\.\s*[:：]?\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function parseRenewalCount(text: string): number | null {
  const match = text.match(/Renewed\s*\((\d+)\)/i);
  return match ? parseInt(match[1], 10) : null;
}

async function scrapePage(url: string): Promise<Array<Record<string, unknown>>> {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);
  const agents: Array<Record<string, unknown>> = [];

  $("table tr, .agent-row, .list-item, tr").each((_i, el) => {
    const $el = $(el);
    const cells = $el.find("td");
    if (cells.length < 2) return;
  });

  const rows = $("table tbody tr");
  if (rows.length > 0) {
    rows.each((_i, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return;

      const firstCell = $(cells[0]).text().trim();
      const serialNumber = parseInt(firstCell, 10);
      if (isNaN(serialNumber)) return;

      const infoCell = $(cells[1]).html() || "";
      const typeCell = $(cells[2]).text().trim();
      const regCell = $(cells[3])?.text().trim() || "";
      const allText = $(cells[1]).text();

      const nameMatch = allText.match(/Name\s*[:：]?\s*([^\n]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : $(cells[1]).find("strong, b").first().text().trim();

      const designationMatch = allText.match(/Designation\s*[:：]?\s*([^\n]+)/i);
      const designation = designationMatch ? designationMatch[1].trim() : null;

      const personNameMatch = allText.match(/Name of person\s*[:：]?\s*([^\n]+)/i);
      const personName = personNameMatch ? personNameMatch[1].trim() : null;

      const addressMatch = allText.match(/Registered Address\s*[:：]?\s*([^\n]+)/i);
      const registeredAddress = addressMatch ? addressMatch[1].trim() : null;

      const phoneMatch = allText.match(/Phone Number\s*[:：]?\s*([^\n]+)/i);
      const phoneNumber = phoneMatch ? phoneMatch[1].trim() : null;

      const emailMatch = allText.match(/Email Id\s*[:：]?\s*([^\n]+)/i);
      const emailId = emailMatch ? emailMatch[1].trim() : null;

      const regNoCell = regCell || allText;
      const registrationNo = parseRegistrationNo(regNoCell);
      const validUntil = parseValidUntil(regNoCell);
      const renewalCount = parseRenewalCount(regNoCell);

      if (!name) return;

      agents.push({
        serialNumber: isNaN(serialNumber) ? null : serialNumber,
        name,
        agentType: typeCell || "Unknown",
        designation,
        personName,
        registeredAddress,
        phoneNumber,
        emailId,
        registrationNo,
        validUntil,
        renewalCount,
      });
    });
  }

  if (agents.length === 0) {
    $(".views-row, .agent-item, [class*='agent']").each((_i, el) => {
      const text = $(el).text();
      const nameMatch = text.match(/Name\s*[:：]\s*([^\n]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : null;
      if (!name) return;

      const typeMatch = text.match(/Individual|Company|Other/i);
      const agentType = typeMatch ? typeMatch[0] : "Unknown";
      const snMatch = text.match(/^\s*(\d+)\s/);
      const serialNumber = snMatch ? parseInt(snMatch[1], 10) : null;

      agents.push({
        serialNumber,
        name,
        agentType,
        designation: text.match(/Designation\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? null,
        personName: text.match(/Name of person\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? null,
        registeredAddress: text.match(/Registered Address\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? null,
        phoneNumber: text.match(/Phone Number\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? null,
        emailId: text.match(/Email Id\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ?? null,
        registrationNo: parseRegistrationNo(text),
        validUntil: parseValidUntil(text),
        renewalCount: parseRenewalCount(text),
      });
    });
  }

  return agents;
}

function findNextPageUrl($: cheerio.CheerioAPI, currentUrl: string): string | null {
  const nextLink = $("a[title='Go to next page'], a.page-link[rel='next'], .pager-next a, li.next a, a:contains('Next'), a:contains('›'), a:contains('»')").first();
  if (!nextLink.length) return null;

  const href = nextLink.attr("href");
  if (!href) return null;

  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://erera.co.in${href}`;

  const base = new URL(currentUrl);
  return `${base.origin}${base.pathname}?${href.replace(/^\?/, "")}`;
}

export async function runScraper(maxPages = 10): Promise<ScrapeResult> {
  if (isRunning) {
    return {
      success: false,
      agentsScraped: 0,
      agentsInserted: 0,
      agentsUpdated: 0,
      message: "Scraper is already running",
    };
  }

  isRunning = true;
  lastRunAt = new Date();
  let totalScraped = 0;
  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    let currentUrl: string | null = BASE_URL;
    let pageCount = 0;

    while (currentUrl && pageCount < maxPages) {
      logger.info({ url: currentUrl, page: pageCount + 1 }, "Scraping page");

      const response = await axios.get(currentUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const agents = await scrapePage(currentUrl);
      totalScraped += agents.length;

      for (const agent of agents) {
        if (!agent.name) continue;

        const existing = agent.registrationNo
          ? await db
              .select()
              .from(agentsTable)
              .where(eq(agentsTable.registrationNo, agent.registrationNo as string))
              .limit(1)
          : [];

        if (existing.length > 0) {
          await db
            .update(agentsTable)
            .set({
              name: agent.name as string,
              agentType: agent.agentType as string,
              designation: agent.designation as string | null,
              personName: agent.personName as string | null,
              registeredAddress: agent.registeredAddress as string | null,
              phoneNumber: agent.phoneNumber as string | null,
              emailId: agent.emailId as string | null,
              validUntil: agent.validUntil as string | null,
              renewalCount: agent.renewalCount as number | null,
              scrapedAt: new Date(),
            })
            .where(eq(agentsTable.id, existing[0].id));
          totalUpdated++;
        } else {
          await db.insert(agentsTable).values({
            serialNumber: agent.serialNumber as number | null,
            name: agent.name as string,
            agentType: agent.agentType as string,
            designation: agent.designation as string | null,
            personName: agent.personName as string | null,
            registeredAddress: agent.registeredAddress as string | null,
            phoneNumber: agent.phoneNumber as string | null,
            emailId: agent.emailId as string | null,
            registrationNo: agent.registrationNo as string | null,
            validUntil: agent.validUntil as string | null,
            renewalCount: agent.renewalCount as number | null,
            scrapedAt: new Date(),
          });
          totalInserted++;
        }
      }

      pageCount++;
      currentUrl = findNextPageUrl($, currentUrl);
      if (currentUrl && pageCount < maxPages) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    return {
      success: true,
      agentsScraped: totalScraped,
      agentsInserted: totalInserted,
      agentsUpdated: totalUpdated,
      message: `Scraped ${pageCount} page(s): ${totalInserted} new, ${totalUpdated} updated`,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, "Scraper failed");
    return {
      success: false,
      agentsScraped: totalScraped,
      agentsInserted: totalInserted,
      agentsUpdated: totalUpdated,
      message: "Scraper failed",
      error,
    };
  } finally {
    isRunning = false;
  }
}
