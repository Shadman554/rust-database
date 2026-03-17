import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ceosTable = pgTable("ceos", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  description: text("description"),
  color: text("color"),
  imageUrl: text("image_url"),
  facebookUrl: text("facebook_url"),
  viberUrl: text("viber_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCeoSchema = createInsertSchema(ceosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCeo = z.infer<typeof insertCeoSchema>;
export type Ceo = typeof ceosTable.$inferSelect;
