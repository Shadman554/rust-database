import { Router, type IRouter } from "express";
import { eq, ilike, or, count } from "drizzle-orm";
import { db, instrumentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset, toStr } from "../lib/pagination.js";

const MAX_Q_LENGTH = 200;
const router: IRouter = Router();

router.get("/instruments", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = toStr(req.query.q);

  if (q && q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  const where = q
    ? or(ilike(instrumentsTable.name, `%${q}%`), ilike(instrumentsTable.category, `%${q}%`))
    : undefined;

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(instrumentsTable).where(where),
    db.select().from(instrumentsTable).where(where).limit(limit).offset(offset).orderBy(instrumentsTable.name),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/instruments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [instrument] = await db.select().from(instrumentsTable).where(eq(instrumentsTable.id, id)).limit(1);
  if (!instrument) { res.status(404).json({ error: "Instrument not found" }); return; }
  res.json(instrument);
});

router.post("/instruments", requireAuth, async (req, res): Promise<void> => {
  const { name, description, usage, category, manufacturer } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [created] = await db.insert(instrumentsTable).values({ name, description, usage, category, manufacturer }).returning();
  res.status(201).json(created);
});

router.put("/instruments/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, description, usage, category, manufacturer } = req.body as Record<string, string>;
  const [updated] = await db
    .update(instrumentsTable)
    .set({ name, description, usage, category, manufacturer })
    .where(eq(instrumentsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Instrument not found" }); return; }
  res.json(updated);
});

router.delete("/instruments/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(instrumentsTable).where(eq(instrumentsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Instrument not found" }); return; }
  res.sendStatus(204);
});

export default router;
