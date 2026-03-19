import { Router, type IRouter } from "express";
import { eq, ilike, or, count } from "drizzle-orm";
import { db, diseasesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset, toStr } from "../lib/pagination.js";

const MAX_Q_LENGTH = 200;
const router: IRouter = Router();

router.get("/diseases", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = toStr(req.query.q);

  if (q && q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  const where = q
    ? or(ilike(diseasesTable.name, `%${q}%`), ilike(diseasesTable.kurdish, `%${q}%`))
    : undefined;

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(diseasesTable).where(where),
    db.select().from(diseasesTable).where(where).limit(limit).offset(offset).orderBy(diseasesTable.name),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/diseases/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [disease] = await db.select().from(diseasesTable).where(eq(diseasesTable.id, id)).limit(1);
  if (!disease) { res.status(404).json({ error: "Disease not found" }); return; }
  res.json(disease);
});

router.post("/diseases", requireAuth, async (req, res): Promise<void> => {
  const { name, kurdish, symptoms, cause, control } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [created] = await db.insert(diseasesTable).values({ name, kurdish, symptoms, cause, control }).returning();
  res.status(201).json(created);
});

router.put("/diseases/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, kurdish, symptoms, cause, control } = req.body as Record<string, string>;
  const [updated] = await db
    .update(diseasesTable)
    .set({ name, kurdish, symptoms, cause, control })
    .where(eq(diseasesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Disease not found" }); return; }
  res.json(updated);
});

router.delete("/diseases/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(diseasesTable).where(eq(diseasesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Disease not found" }); return; }
  res.sendStatus(204);
});

export default router;
