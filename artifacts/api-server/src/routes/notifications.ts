import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset } from "../lib/pagination.js";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(notificationsTable),
    db.select().from(notificationsTable).limit(limit).offset(offset).orderBy(notificationsTable.createdAt),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/notifications/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [notification] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id)).limit(1);
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json(notification);
});

router.post("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { title, body, imageUrl, type } = req.body as Record<string, string>;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  const [created] = await db.insert(notificationsTable).values({ title, body, imageUrl, type }).returning();
  res.status(201).json(created);
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json(updated);
});

router.delete("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(notificationsTable).where(eq(notificationsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Notification not found" }); return; }
  res.sendStatus(204);
});

export default router;
