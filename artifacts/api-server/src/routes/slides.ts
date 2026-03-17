import { Router, type IRouter } from "express";
import { eq, ilike, or, count, and } from "drizzle-orm";
import { db, slidesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset } from "../lib/pagination.js";

const router: IRouter = Router();

router.get("/slides", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = req.query.q as string | undefined;
  const category = req.query.category as string | undefined;

  const conditions = [];
  if (category) conditions.push(eq(slidesTable.category, category));
  if (q) conditions.push(or(ilike(slidesTable.name, `%${q}%`), ilike(slidesTable.species, `%${q}%`))!);

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [totalResult] = await db.select({ count: count() }).from(slidesTable).where(where);
  const items = await db.select().from(slidesTable).where(where).limit(limit).offset(offset).orderBy(slidesTable.name);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/slides/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [slide] = await db.select().from(slidesTable).where(eq(slidesTable.id, id)).limit(1);
  if (!slide) { res.status(404).json({ error: "Slide not found" }); return; }
  res.json(slide);
});

router.post("/slides", requireAuth, async (req, res): Promise<void> => {
  const { name, species, imageUrl, category } = req.body as Record<string, string>;
  if (!name || !category) { res.status(400).json({ error: "name and category are required" }); return; }
  const [created] = await db.insert(slidesTable).values({ name, species, imageUrl, category }).returning();
  res.status(201).json(created);
});

router.put("/slides/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, species, imageUrl, category } = req.body as Record<string, string>;
  const [updated] = await db
    .update(slidesTable)
    .set({ name, species, imageUrl, category })
    .where(eq(slidesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Slide not found" }); return; }
  res.json(updated);
});

router.delete("/slides/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(slidesTable).where(eq(slidesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Slide not found" }); return; }
  res.sendStatus(204);
});

export default router;
