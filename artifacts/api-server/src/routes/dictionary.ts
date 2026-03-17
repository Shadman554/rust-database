import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, count } from "drizzle-orm";
import { db, wordsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset } from "../lib/pagination.js";

const router: IRouter = Router();

router.get("/dictionary", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = req.query.q as string | undefined;

  const where = q
    ? or(ilike(wordsTable.name, `%${q}%`), ilike(wordsTable.kurdish, `%${q}%`))
    : undefined;

  const [totalResult] = await db.select({ count: count() }).from(wordsTable).where(where);
  const items = await db.select().from(wordsTable).where(where).limit(limit).offset(offset).orderBy(wordsTable.name);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/dictionary/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, id)).limit(1);
  if (!word) { res.status(404).json({ error: "Word not found" }); return; }
  res.json(word);
});

router.post("/dictionary", requireAuth, async (req, res): Promise<void> => {
  const { name, kurdish, arabic, description, category } = req.body as Record<string, string>;
  if (!name || !kurdish) {
    res.status(400).json({ error: "name and kurdish are required" });
    return;
  }
  const [created] = await db.insert(wordsTable).values({ name, kurdish, arabic, description, category }).returning();
  res.status(201).json(created);
});

router.put("/dictionary/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, kurdish, arabic, description, category } = req.body as Record<string, string>;
  const [updated] = await db
    .update(wordsTable)
    .set({ name, kurdish, arabic, description, category })
    .where(eq(wordsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Word not found" }); return; }
  res.json(updated);
});

router.delete("/dictionary/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(wordsTable).where(eq(wordsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Word not found" }); return; }
  res.sendStatus(204);
});

export default router;
