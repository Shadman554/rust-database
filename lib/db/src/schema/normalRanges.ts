import { pgTable, serial, text, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const normalRangesTable = pgTable("normal_ranges", {
  id: serial("id").primaryKey(),
  name: text("name"),
  parameter: text("parameter").notNull(),
  species: text("species").notNull(),
  category: text("category"),
  minValue: doublePrecision("min_value"),
  maxValue: doublePrecision("max_value"),
  unit: text("unit"),
  description: text("description"),
  reference: text("reference"),
  note: text("note"),
  panicLow: text("panic_low"),
  panicHigh: text("panic_high"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("normal_ranges_species_idx").on(t.species),
  index("normal_ranges_category_idx").on(t.category),
  index("normal_ranges_parameter_idx").on(t.parameter),
  index("normal_ranges_species_category_idx").on(t.species, t.category),
]);

export const insertNormalRangeSchema = createInsertSchema(normalRangesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNormalRange = z.infer<typeof insertNormalRangeSchema>;
export type NormalRange = typeof normalRangesTable.$inferSelect;
