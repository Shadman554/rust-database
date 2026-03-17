import { Router, type IRouter } from "express";
import { eq, ilike, or, count, and } from "drizzle-orm";
import { db, normalRangesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset } from "../lib/pagination.js";

const router: IRouter = Router();

router.get("/normal-ranges", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = req.query.q as string | undefined;
  const species = req.query.species as string | undefined;
  const category = req.query.category as string | undefined;

  const conditions = [];
  if (species) conditions.push(eq(normalRangesTable.species, species));
  if (category) conditions.push(eq(normalRangesTable.category, category));
  if (q) conditions.push(or(ilike(normalRangesTable.parameter, `%${q}%`), ilike(normalRangesTable.species, `%${q}%`))!);

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [totalResult] = await db.select({ count: count() }).from(normalRangesTable).where(where);
  const items = await db.select().from(normalRangesTable).where(where).limit(limit).offset(offset).orderBy(normalRangesTable.parameter);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/normal-ranges/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [range] = await db.select().from(normalRangesTable).where(eq(normalRangesTable.id, id)).limit(1);
  if (!range) { res.status(404).json({ error: "Normal range not found" }); return; }
  res.json(range);
});

router.post("/normal-ranges", requireAuth, async (req, res): Promise<void> => {
  const { name, parameter, species, category, unit, description, reference, note, panicLow, panicHigh } = req.body as Record<string, string>;
  const minValue = req.body.minValue !== undefined ? Number(req.body.minValue) : undefined;
  const maxValue = req.body.maxValue !== undefined ? Number(req.body.maxValue) : undefined;

  if (!parameter || !species) { res.status(400).json({ error: "parameter and species are required" }); return; }
  const [created] = await db.insert(normalRangesTable).values({ name, parameter, species, category, minValue, maxValue, unit, description, reference, note, panicLow, panicHigh }).returning();
  res.status(201).json(created);
});

router.put("/normal-ranges/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, parameter, species, category, unit, description, reference, note, panicLow, panicHigh } = req.body as Record<string, string>;
  const minValue = req.body.minValue !== undefined ? Number(req.body.minValue) : undefined;
  const maxValue = req.body.maxValue !== undefined ? Number(req.body.maxValue) : undefined;

  const [updated] = await db
    .update(normalRangesTable)
    .set({ name, parameter, species, category, minValue, maxValue, unit, description, reference, note, panicLow, panicHigh })
    .where(eq(normalRangesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Normal range not found" }); return; }
  res.json(updated);
});

router.delete("/normal-ranges/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(normalRangesTable).where(eq(normalRangesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Normal range not found" }); return; }
  res.sendStatus(204);
});

export default router;
