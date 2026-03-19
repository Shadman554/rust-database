import { Router, type IRouter } from "express";
import { eq, ilike, or, count, and } from "drizzle-orm";
import { db, testsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset, toStr } from "../lib/pagination.js";

const MAX_Q_LENGTH = 200;
const router: IRouter = Router();

router.get("/tests", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = toStr(req.query.q);
  const category = toStr(req.query.category);

  if (q && q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  const conditions = [];
  if (category) conditions.push(eq(testsTable.category, category));
  if (q) conditions.push(or(ilike(testsTable.name, `%${q}%`), ilike(testsTable.species, `%${q}%`))!);

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(testsTable).where(where),
    db.select().from(testsTable).where(where).limit(limit).offset(offset).orderBy(testsTable.name),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/tests/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [test] = await db.select().from(testsTable).where(eq(testsTable.id, id)).limit(1);
  if (!test) { res.status(404).json({ error: "Test not found" }); return; }
  res.json(test);
});

router.post("/tests", requireAuth, async (req, res): Promise<void> => {
  const { name, description, imageUrl, category, species } = req.body as Record<string, string>;
  if (!name || !category) { res.status(400).json({ error: "name and category are required" }); return; }
  const [created] = await db.insert(testsTable).values({ name, description, imageUrl, category, species }).returning();
  res.status(201).json(created);
});

router.put("/tests/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, description, imageUrl, category, species } = req.body as Record<string, string>;
  const [updated] = await db
    .update(testsTable)
    .set({ name, description, imageUrl, category, species })
    .where(eq(testsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Test not found" }); return; }
  res.json(updated);
});

router.delete("/tests/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(testsTable).where(eq(testsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Test not found" }); return; }
  res.sendStatus(204);
});

export default router;
