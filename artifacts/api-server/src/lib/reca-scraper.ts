import axios from "axios";
import * as cheerio from "cheerio";
import { db, recaMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const RECA_URL = "https://www.recakol.com/individual.php";
const BASE_URL = "https://www.recakol.com/";

export interface RecaScrapeResult {
  success: boolean;
  scraped: number;
  inserted: number;
  updated: number;
  message: string;
  error?: string;
}

let isRunning = false;
let lastRunAt: Date | null = null;

export function getRecaScraperState() {
  return { isRunning, lastRunAt };
}

function normalize(val: string | undefined | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "NA" || trimmed === "-" || trimmed === "N/A") return null;
  return trimmed;
}

export async function scrapeRecaMembers(): Promise<RecaScrapeResult> {
  if (isRunning) {
    return {
      success: false,
      scraped: 0,
      inserted: 0,
      updated: 0,
      message: "Scraper is already running",
    };
  }

  isRunning = true;
  try {
    logger.info("Starting RECA Kolkata members scrape");

    const response = await axios.get(RECA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data as string);
    const rows = $("table.table-striped.table-bordered tr").slice(1);

    let scraped = 0;
    let inserted = 0;
    let updated = 0;

    for (const row of rows.toArray()) {
      const cells = $(row).find("td");
      if (cells.length < 20) continue;

      const photoSrc = $(cells[0]).find("img").attr("src");
      const photoUrl =
        photoSrc && photoSrc !== "#" && photoSrc.trim() !== ""
          ? photoSrc.startsWith("http")
            ? photoSrc.trim()
            : BASE_URL + photoSrc.trim()
          : null;

      const name = normalize($(cells[1]).text());
      if (!name) continue;

      const membershipId = normalize($(cells[4]).text());
      if (!membershipId) continue;

      const data = {
        photoUrl,
        name,
        age: normalize($(cells[2]).text()),
        companyName: normalize($(cells[3]).text()),
        membershipId,
        reraNo: normalize($(cells[5]).text()),
        hiraNo: normalize($(cells[6]).text()),
        gstNo: normalize($(cells[7]).text()),
        mobileNo: normalize($(cells[8]).text()),
        altMobileNo: normalize($(cells[9]).text()),
        landline: normalize($(cells[10]).text()),
        email: normalize($(cells[11]).text()),
        website: normalize($(cells[12]).text()),
        address: normalize($(cells[13]).text()),
        city: normalize($(cells[14]).text()),
        associationName: normalize($(cells[15]).text()),
        coreCompetence1: normalize($(cells[16]).text()),
        coreCompetence2: normalize($(cells[17]).text()),
        coreCompetence3: normalize($(cells[18]).text()),
        coreCompetence4: normalize($(cells[19]).text()),
        scrapedAt: new Date(),
      };

      scraped++;

      const existing = await db
        .select({ id: recaMembersTable.id })
        .from(recaMembersTable)
        .where(eq(recaMembersTable.membershipId, membershipId));

      if (existing.length > 0) {
        await db
          .update(recaMembersTable)
          .set(data)
          .where(eq(recaMembersTable.membershipId, membershipId));
        updated++;
      } else {
        await db.insert(recaMembersTable).values(data);
        inserted++;
      }
    }

    lastRunAt = new Date();
    logger.info({ scraped, inserted, updated }, "RECA Kolkata members scrape complete");

    return {
      success: true,
      scraped,
      inserted,
      updated,
      message: `Scraped ${scraped} members (${inserted} new, ${updated} updated)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "RECA scrape failed");
    return {
      success: false,
      scraped: 0,
      inserted: 0,
      updated: 0,
      message: "Scrape failed",
      error: message,
    };
  } finally {
    isRunning = false;
  }
}
