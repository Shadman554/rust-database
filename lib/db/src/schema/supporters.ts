import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportersTable = pgTable("supporters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  color: text("color"),
  icon: text("icon"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSupporterSchema = createInsertSchema(supportersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupporter = z.infer<typeof insertSupporterSchema>;
export type Supporter = typeof supportersTable.$inferSelect;
