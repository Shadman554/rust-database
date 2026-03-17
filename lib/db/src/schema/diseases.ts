import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diseasesTable = pgTable("diseases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kurdish: text("kurdish"),
  symptoms: text("symptoms"),
  cause: text("cause"),
  control: text("control"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("diseases_name_idx").on(t.name),
]);

export const insertDiseaseSchema = createInsertSchema(diseasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDisease = z.infer<typeof insertDiseaseSchema>;
export type Disease = typeof diseasesTable.$inferSelect;
