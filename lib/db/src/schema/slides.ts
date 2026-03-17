import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const slidesTable = pgTable("slides", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  species: text("species"),
  imageUrl: text("image_url"),
  category: text("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("slides_category_idx").on(t.category),
  index("slides_species_idx").on(t.species),
]);

export const insertSlideSchema = createInsertSchema(slidesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSlide = z.infer<typeof insertSlideSchema>;
export type Slide = typeof slidesTable.$inferSelect;
