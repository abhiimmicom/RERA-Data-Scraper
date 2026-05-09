import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recaMembersTable = pgTable("reca_members", {
  id: serial("id").primaryKey(),
  photoUrl: text("photo_url"),
  name: text("name").notNull(),
  age: text("age"),
  companyName: text("company_name"),
  membershipId: text("membership_id").unique(),
  reraNo: text("rera_no"),
  hiraNo: text("hira_no"),
  gstNo: text("gst_no"),
  mobileNo: text("mobile_no"),
  altMobileNo: text("alt_mobile_no"),
  landline: text("landline"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  associationName: text("association_name"),
  coreCompetence1: text("core_competence_1"),
  coreCompetence2: text("core_competence_2"),
  coreCompetence3: text("core_competence_3"),
  coreCompetence4: text("core_competence_4"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRecaMemberSchema = createInsertSchema(recaMembersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRecaMember = z.infer<typeof insertRecaMemberSchema>;
export type RecaMember = typeof recaMembersTable.$inferSelect;
