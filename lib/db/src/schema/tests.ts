import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testsTable = pgTable("tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  category: text("category").notNull(),
  species: text("species"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("tests_category_idx").on(t.category),
  index("tests_name_idx").on(t.name),
]);

export const insertTestSchema = createInsertSchema(testsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof testsTable.$inferSelect;
