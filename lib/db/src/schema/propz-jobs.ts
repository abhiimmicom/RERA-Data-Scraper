import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const propzJobsTable = pgTable("propz_scrape_jobs", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("pending"),
  totalPages: integer("total_pages"),
  pagesScraped: integer("pages_scraped").default(0),
  agentsFound: integer("agents_found").default(0),
  fetchDetails: boolean("fetch_details").notNull().default(false),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PropzJob = typeof propzJobsTable.$inferSelect;
