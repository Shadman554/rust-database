import { Router, type IRouter } from "express";
import { eq, ilike, or, count } from "drizzle-orm";
import { db, drugsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset, toStr } from "../lib/pagination.js";

const MAX_Q_LENGTH = 200;
const router: IRouter = Router();

router.get("/drugs", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = toStr(req.query.q);

  if (q && q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  const where = q
    ? or(ilike(drugsTable.name, `%${q}%`), ilike(drugsTable.drugClass, `%${q}%`))
    : undefined;

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(drugsTable).where(where),
    db.select().from(drugsTable).where(where).limit(limit).offset(offset).orderBy(drugsTable.name),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/drugs/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [drug] = await db.select().from(drugsTable).where(eq(drugsTable.id, id)).limit(1);
  if (!drug) { res.status(404).json({ error: "Drug not found" }); return; }
  res.json(drug);
});

router.post("/drugs", requireAuth, async (req, res): Promise<void> => {
  const { name, usage, sideEffect, otherInfo, drugClass, tradeNames, speciesDosages, contraindications, drugInteractions, withdrawalTimes } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [created] = await db.insert(drugsTable).values({ name, usage, sideEffect, otherInfo, drugClass, tradeNames, speciesDosages, contraindications, drugInteractions, withdrawalTimes }).returning();
  res.status(201).json(created);
});

router.put("/drugs/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, usage, sideEffect, otherInfo, drugClass, tradeNames, speciesDosages, contraindications, drugInteractions, withdrawalTimes } = req.body as Record<string, string>;
  const [updated] = await db
    .update(drugsTable)
    .set({ name, usage, sideEffect, otherInfo, drugClass, tradeNames, speciesDosages, contraindications, drugInteractions, withdrawalTimes })
    .where(eq(drugsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Drug not found" }); return; }
  res.json(updated);
});

router.delete("/drugs/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(drugsTable).where(eq(drugsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Drug not found" }); return; }
  res.sendStatus(204);
});

export default router;
