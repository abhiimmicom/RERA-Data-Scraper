import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const rivirtualAgentsTable = pgTable("rivirtual_agents", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique(),
  jobId: integer("job_id"),
  label: text("label"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  propertyType: text("property_type"),
  photoUrl: text("photo_url"),
  remotePhotoUrl: text("remote_photo_url"),
  detailUrl: text("detail_url"),
  city: text("city"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RivirtualAgent = typeof rivirtualAgentsTable.$inferSelect;
