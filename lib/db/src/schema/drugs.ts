import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const drugsTable = pgTable("drugs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  usage: text("usage"),
  sideEffect: text("side_effect"),
  otherInfo: text("other_info"),
  drugClass: text("drug_class"),
  tradeNames: text("trade_names"),
  speciesDosages: text("species_dosages"),
  contraindications: text("contraindications"),
  drugInteractions: text("drug_interactions"),
  withdrawalTimes: text("withdrawal_times"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("drugs_name_idx").on(t.name),
  index("drugs_class_idx").on(t.drugClass),
]);

export const insertDrugSchema = createInsertSchema(drugsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDrug = z.infer<typeof insertDrugSchema>;
export type Drug = typeof drugsTable.$inferSelect;
