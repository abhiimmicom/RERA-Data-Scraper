import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const propzAgentsTable = pgTable("propz_agents", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id"),
  label: text("label"),
  name: text("name").notNull(),
  reraId: text("rera_id"),
  designation: text("designation"),
  photoUrl: text("photo_url"),
  mobile: text("mobile"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  detailUrl: text("detail_url"),
  bio: text("bio"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PropzAgent = typeof propzAgentsTable.$inferSelect;
