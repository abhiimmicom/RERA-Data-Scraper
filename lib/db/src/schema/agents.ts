import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("rera_agents", {
  id: serial("id").primaryKey(),
  serialNumber: integer("serial_number"),
  name: text("name").notNull(),
  agentType: text("agent_type").notNull(),
  designation: text("designation"),
  personName: text("person_name"),
  registeredAddress: text("registered_address"),
  phoneNumber: text("phone_number"),
  emailId: text("email_id"),
  registrationNo: text("registration_no"),
  validUntil: text("valid_until"),
  certificateUrl: text("certificate_url"),
  renewalCount: integer("renewal_count"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
