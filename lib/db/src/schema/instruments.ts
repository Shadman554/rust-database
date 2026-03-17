import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instrumentsTable = pgTable("instruments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  usage: text("usage"),
  category: text("category"),
  imageUrl: text("image_url"),
  manufacturer: text("manufacturer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("instruments_name_idx").on(t.name),
  index("instruments_category_idx").on(t.category),
]);

export const insertInstrumentSchema = createInsertSchema(instrumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstrument = z.infer<typeof insertInstrumentSchema>;
export type Instrument = typeof instrumentsTable.$inferSelect;
