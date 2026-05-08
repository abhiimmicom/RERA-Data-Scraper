import axios from "axios";
import * as cheerio from "cheerio";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const AGENT_LIST_URL = "https://erera.co.in/reradelhiindex/PublicView/AgentInfo";
const AGENT_DETAIL_URL = "https://erera.co.in/reradelhiindex/PublicView/AgentViewDetails";

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

const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: AGENT_LIST_URL,
};

interface AgentRow {
  serialNumber: number | null;
  name: string;
  area: string | null;
  registrationNo: string | null;
  validUntil: string | null;
  agentType: string;
  internalId: number | null;
}

async function fetchAllAgentRows(): Promise<AgentRow[]> {
  const response = await axios.post(
    AGENT_LIST_URL,
    new URLSearchParams({
      Agent_Name: "",
      Project_Name: "",
      RERAnumberRegistration: "",
      AgentType: "0",
      submit: "Search",
    }).toString(),
    {
      headers: {
        ...HTTP_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 60000,
    },
  );

  const $ = cheerio.load(response.data);
  const agents: AgentRow[] = [];

  $("table#dataTableSearchAgent tbody tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 6) return;

    const serialText = $(cells[0]).text().trim();
    const serialNumber = parseInt(serialText, 10);

    const nameTd = $(cells[1]);
    const name = (nameTd.attr("data-agent-name") || nameTd.text().trim()).trim();
    const hiddenInput = nameTd.find("input.hdnAgentID");
    const internalIdText = hiddenInput.val() as string | undefined;
    const internalId = internalIdText ? parseInt(internalIdText, 10) : null;

    const area = $(cells[2]).text().trim() || null;

    const regNoTd = $(cells[3]);
    const registrationNo = (regNoTd.attr("data-diary-no") || regNoTd.text().trim()).trim() || null;

    const validUntil = $(cells[4]).text().trim() || null;
    const agentType = $(cells[5]).text().trim() || "Unknown";

    if (!name) return;

    agents.push({
      serialNumber: isNaN(serialNumber) ? null : serialNumber,
      name,
      area,
      registrationNo,
      validUntil,
      agentType,
      internalId,
    });
  });

  return agents;
}

async function fetchAgentDetails(internalId: number): Promise<{
  designation: string | null;
  personName: string | null;
  registeredAddress: string | null;
  phoneNumber: string | null;
  emailId: string | null;
  certificateUrl: string | null;
  renewalCount: number | null;
}> {
  const response = await axios.get(AGENT_DETAIL_URL, {
    params: { inAgent_ID: internalId },
    headers: HTTP_HEADERS,
    timeout: 20000,
  });

  const $ = cheerio.load(response.data);
  const text = $("body").text();

  const field = (label: string): string | null => {
    const patterns = [
      new RegExp(`${label}\\s*[:\\-]\\s*([^\\n\\r]+)`, "i"),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return m[1].trim().replace(/\s+/g, " ") || null;
    }
    return null;
  };

  const designation = field("Designation");
  const personName = field("Name of (?:the )?(?:Authorized )?(?:person|proprietor|partner)");
  const phoneNumber = field("(?:Phone|Mobile|Contact)\\s*(?:No\\.?|Number)?");
  const emailId = field("Email\\s*(?:Id|Address)?");
  const registeredAddress = field("Registered Address");

  const certLink = $("a[href*='Certificate'], a[href*='certificate']").first().attr("href") || null;

  const renewalMatch = text.match(/Renewed\s*\((\d+)\)/i);
  const renewalCount = renewalMatch ? parseInt(renewalMatch[1], 10) : null;

  return {
    designation,
    personName,
    registeredAddress,
    phoneNumber,
    emailId,
    certificateUrl: certLink,
    renewalCount,
  };
}

export async function runScraper(maxAgents = 0): Promise<ScrapeResult> {
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
  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    logger.info("Fetching all agents from RERA portal");
    const rows = await fetchAllAgentRows();

    const agentsToProcess = maxAgents > 0 ? rows.slice(0, maxAgents) : rows;
    logger.info({ total: agentsToProcess.length }, "Fetched agent rows");

    for (let i = 0; i < agentsToProcess.length; i++) {
      const row = agentsToProcess[i]!;

      let details: Awaited<ReturnType<typeof fetchAgentDetails>> | null = null;
      if (row.internalId) {
        try {
          details = await fetchAgentDetails(row.internalId);
        } catch (e) {
          logger.warn({ internalId: row.internalId, err: String(e) }, "Failed to fetch agent details");
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      const existing = row.registrationNo
        ? await db
            .select()
            .from(agentsTable)
            .where(eq(agentsTable.registrationNo, row.registrationNo))
            .limit(1)
        : [];

      const values = {
        name: row.name,
        agentType: row.agentType,
        registeredAddress: details?.registeredAddress ?? row.area,
        designation: details?.designation ?? null,
        personName: details?.personName ?? null,
        phoneNumber: details?.phoneNumber ?? null,
        emailId: details?.emailId ?? null,
        validUntil: row.validUntil,
        certificateUrl: details?.certificateUrl ?? null,
        renewalCount: details?.renewalCount ?? null,
        scrapedAt: new Date(),
      };

      if (existing.length > 0) {
        await db
          .update(agentsTable)
          .set(values)
          .where(eq(agentsTable.id, existing[0]!.id));
        totalUpdated++;
      } else {
        await db.insert(agentsTable).values({
          ...values,
          serialNumber: row.serialNumber,
          registrationNo: row.registrationNo,
        });
        totalInserted++;
      }

      if (i > 0 && i % 50 === 0) {
        logger.info({ processed: i, total: agentsToProcess.length }, "Scraping progress");
      }
    }

    return {
      success: true,
      agentsScraped: agentsToProcess.length,
      agentsInserted: totalInserted,
      agentsUpdated: totalUpdated,
      message: `Scraped ${agentsToProcess.length} agents: ${totalInserted} new, ${totalUpdated} updated`,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error }, "Scraper failed");
    return {
      success: false,
      agentsScraped: 0,
      agentsInserted: totalInserted,
      agentsUpdated: totalUpdated,
      message: "Scraper failed",
      error,
    };
  } finally {
    isRunning = false;
  }
}
