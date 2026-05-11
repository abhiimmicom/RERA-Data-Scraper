import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const rivirtualJobsTable = pgTable("rivirtual_jobs", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("pending"),
  maxPages: integer("max_pages").default(10),
  totalPages: integer("total_pages"),
  pagesScraped: integer("pages_scraped").default(0),
  agentsFound: integer("agents_found").default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RivirtualJob = typeof rivirtualJobsTable.$inferSelect;
