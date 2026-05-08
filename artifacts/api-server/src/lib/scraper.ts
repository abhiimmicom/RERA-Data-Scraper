import axios from "axios";
import * as cheerio from "cheerio";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ANGULAR_BUNDLE_URL = "https://erera.co.in/ereradelhi/main.8c1323f0766b7401.js";
const AGENT_LIST_URL = "https://erera.co.in/reradelhiindex/PublicView/AgentInfo";

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
};

interface AgentContact {
  serialNumber: number | null;
  name: string;
  designation: string | null;
  personName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  agentType: string | null;
  registrationNo: string;
  validUntil: string | null;
}

interface AgentListing {
  serialNumber: number | null;
  name: string;
  area: string | null;
  registrationNo: string;
  validUntil: string | null;
  agentType: string;
  internalId: number | null;
}

function extractTemplateTokens(bundle: string): string[] {
  const startMarker = "decls:29836";
  const startPos = bundle.indexOf(startMarker);
  if (startPos === -1) {
    logger.warn("Angular bundle marker not found — bundle may have been updated");
    return [];
  }

  const templateStart = bundle.indexOf("template:function", startPos);
  if (templateStart === -1) return [];

  let depth = 0, inStr = false, strChar = "", templateEnd = templateStart;
  for (let i = templateStart; i < bundle.length; i++) {
    const c = bundle[i];
    if (!inStr && (c === '"' || c === "'")) { inStr = true; strChar = c; }
    else if (inStr && c === strChar && bundle[i - 1] !== "\\") { inStr = false; }
    else if (!inStr && c === "{") depth++;
    else if (!inStr && c === "}") { depth--; if (depth === 0) { templateEnd = i; break; } }
  }

  const templateCode = bundle.slice(templateStart, templateEnd + 1);
  const ePattern = /\be\((\d+),"((?:[^"\\]|\\.)*)"\)/g;
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = ePattern.exec(templateCode)) !== null) {
    const text = m[2]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\xa0/g, " ")
      .replace(/\\u00a0/g, " ")
      .trim();
    if (text) tokens.push(text);
  }
  return tokens;
}

function parseAgentsFromTokens(tokens: string[]): AgentContact[] {
  const LAB = (s: string) => s.replace(/\s+/g, " ").toLowerCase().trim();
  const SERIAL_RE = /^\d+$/;
  const agents: AgentContact[] = [];

  let idx = 6; // skip 6 header tokens

  while (idx < tokens.length) {
    if (!SERIAL_RE.test((tokens[idx] ?? "").trim())) { idx++; continue; }

    const agent: AgentContact = {
      serialNumber: parseInt(tokens[idx]!.trim(), 10),
      name: "",
      designation: null,
      personName: null,
      address: null,
      phone: null,
      email: null,
      agentType: null,
      registrationNo: "",
      validUntil: null,
    };
    idx++;

    while (idx < tokens.length && LAB(tokens[idx]!) !== "certificate :") {
      const lab = LAB(tokens[idx]!);
      if (lab === "name :") { agent.name = (tokens[idx + 1] ?? "").trim(); idx += 2; }
      else if (lab === "designation :") { agent.designation = (tokens[idx + 1] ?? "").trim() || null; idx += 2; }
      else if (lab === "name of person :") { agent.personName = (tokens[idx + 1] ?? "").trim() || null; idx += 2; }
      else if (lab === "registered address :") { agent.address = (tokens[idx + 1] ?? "").trim() || null; idx += 2; }
      else if (lab === "phone number :") { agent.phone = (tokens[idx + 1] ?? "").trim() || null; idx += 2; }
      else if (lab === "email id :" || lab === "email :") { agent.email = (tokens[idx + 1] ?? "").trim() || null; idx += 2; }
      else if (lab === "registration no. :") { agent.registrationNo = (tokens[idx + 1] ?? "").trim(); idx += 2; }
      else if (lab === "valid until :") { agent.validUntil = (tokens[idx + 1] ?? "").trim() || null; idx += 2; }
      else {
        const tok = tokens[idx]!;
        if (!agent.agentType && tok && !tok.includes(":") && tok.length < 100) {
          agent.agentType = tok.trim();
        }
        idx++;
      }
    }
    if (LAB(tokens[idx] ?? "") === "certificate :") idx++;

    if (agent.name && agent.registrationNo) agents.push(agent);
  }

  return agents;
}

async function fetchContactsFromAngularBundle(): Promise<Map<string, AgentContact>> {
  logger.info("Fetching Angular bundle for contact details");
  const response = await axios.get(ANGULAR_BUNDLE_URL, {
    headers: { ...HTTP_HEADERS, Accept: "application/javascript, */*" },
    timeout: 120000,
    responseType: "text",
  });

  const tokens = extractTemplateTokens(response.data as string);
  if (tokens.length === 0) {
    logger.warn("No tokens extracted from Angular bundle");
    return new Map();
  }

  const agents = parseAgentsFromTokens(tokens);
  logger.info({ count: agents.length }, "Parsed agents from Angular bundle");

  const map = new Map<string, AgentContact>();
  for (const a of agents) {
    if (a.registrationNo) map.set(a.registrationNo, a);
  }
  return map;
}

async function fetchAllAgentListings(): Promise<AgentListing[]> {
  logger.info("Fetching agent listing from RERA MVC portal");
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
        Referer: AGENT_LIST_URL,
      },
      timeout: 60000,
    },
  );

  const $ = cheerio.load(response.data as string);
  const agents: AgentListing[] = [];

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
    const registrationNo = (regNoTd.attr("data-diary-no") || regNoTd.text().trim()).trim();
    const validUntil = $(cells[4]).text().trim() || null;
    const agentType = $(cells[5]).text().trim() || "Unknown";

    if (!name || !registrationNo) return;

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

  logger.info({ count: agents.length }, "Fetched agent listings from MVC portal");
  return agents;
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
    // Fetch both data sources in parallel
    const [contactMap, listings] = await Promise.all([
      fetchContactsFromAngularBundle(),
      fetchAllAgentListings(),
    ]);

    const agentsToProcess = maxAgents > 0 ? listings.slice(0, maxAgents) : listings;
    logger.info({ total: agentsToProcess.length, withContacts: contactMap.size }, "Starting upsert");

    for (let i = 0; i < agentsToProcess.length; i++) {
      const listing = agentsToProcess[i]!;
      const contact = contactMap.get(listing.registrationNo);

      const existing = await db
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.registrationNo, listing.registrationNo))
        .limit(1);

      const values = {
        name: contact?.name || listing.name,
        agentType: contact?.agentType || listing.agentType,
        registeredAddress: contact?.address ?? listing.area,
        designation: contact?.designation ?? null,
        personName: contact?.personName ?? null,
        phoneNumber: contact?.phone ?? null,
        emailId: contact?.email ?? null,
        validUntil: contact?.validUntil ?? listing.validUntil,
        certificateUrl: null,
        renewalCount: null,
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
          serialNumber: listing.serialNumber,
          registrationNo: listing.registrationNo,
        });
        totalInserted++;
      }

      if (i > 0 && i % 100 === 0) {
        logger.info({ processed: i, total: agentsToProcess.length }, "Scraping progress");
      }
    }

    return {
      success: true,
      agentsScraped: agentsToProcess.length,
      agentsInserted: totalInserted,
      agentsUpdated: totalUpdated,
      message: `Scraped ${agentsToProcess.length} agents: ${totalInserted} new, ${totalUpdated} updated. Contact details available for ${contactMap.size} agents.`,
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
