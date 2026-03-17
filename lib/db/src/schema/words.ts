import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wordsTable = pgTable("words", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kurdish: text("kurdish").notNull(),
  arabic: text("arabic"),
  description: text("description"),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("words_name_idx").on(t.name),
  index("words_kurdish_idx").on(t.kurdish),
  index("words_category_idx").on(t.category),
]);

export const insertWordSchema = createInsertSchema(wordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWord = z.infer<typeof insertWordSchema>;
export type Word = typeof wordsTable.$inferSelect;
