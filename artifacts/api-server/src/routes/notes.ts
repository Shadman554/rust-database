import { Router, type IRouter } from "express";
import { eq, ilike, or, count } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset, toStr } from "../lib/pagination.js";

const MAX_Q_LENGTH = 200;
const router: IRouter = Router();

router.get("/notes", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = toStr(req.query.q);

  if (q && q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  const where = q
    ? or(ilike(notesTable.name, `%${q}%`), ilike(notesTable.description, `%${q}%`))
    : undefined;

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(notesTable).where(where),
    db.select().from(notesTable).where(where).limit(limit).offset(offset).orderBy(notesTable.name),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [note] = await db.select().from(notesTable).where(eq(notesTable.id, id)).limit(1);
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(note);
});

router.post("/notes", requireAuth, async (req, res): Promise<void> => {
  const { name, description, imageUrl } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [created] = await db.insert(notesTable).values({ name, description, imageUrl }).returning();
  res.status(201).json(created);
});

router.put("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, description, imageUrl } = req.body as Record<string, string>;
  const [updated] = await db
    .update(notesTable)
    .set({ name, description, imageUrl })
    .where(eq(notesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(updated);
});

router.delete("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(notesTable).where(eq(notesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Note not found" }); return; }
  res.sendStatus(204);
});

export default router;
