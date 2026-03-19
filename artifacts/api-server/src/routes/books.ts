import { Router, type IRouter } from "express";
import { eq, ilike, or, count, and } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { parsePagination, buildPagination, getOffset, toStr } from "../lib/pagination.js";

const MAX_Q_LENGTH = 200;
const router: IRouter = Router();

router.get("/books", async (req, res): Promise<void> => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const offset = getOffset(page, limit);
  const q = toStr(req.query.q);
  const category = toStr(req.query.category);

  if (q && q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  const conditions = [];
  if (category) conditions.push(eq(booksTable.category, category));
  if (q) conditions.push(or(ilike(booksTable.title, `%${q}%`), ilike(booksTable.author, `%${q}%`))!);

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [[totalResult], items] = await Promise.all([
    db.select({ count: count() }).from(booksTable).where(where),
    db.select().from(booksTable).where(where).limit(limit).offset(offset).orderBy(booksTable.title),
  ]);

  res.json({ items, pagination: buildPagination(page, limit, Number(totalResult?.count ?? 0)) });
});

router.get("/books/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id)).limit(1);
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }
  res.json(book);
});

router.post("/books", requireAuth, async (req, res): Promise<void> => {
  const { title, author, isbn, description, category, coverUrl, downloadUrl } = req.body as Record<string, string>;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  const [created] = await db.insert(booksTable).values({ title, author, isbn, description, category, coverUrl, downloadUrl }).returning();
  res.status(201).json(created);
});

router.put("/books/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { title, author, isbn, description, category, coverUrl, downloadUrl } = req.body as Record<string, string>;
  const [updated] = await db
    .update(booksTable)
    .set({ title, author, isbn, description, category, coverUrl, downloadUrl })
    .where(eq(booksTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Book not found" }); return; }
  res.json(updated);
});

router.delete("/books/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(booksTable).where(eq(booksTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Book not found" }); return; }
  res.sendStatus(204);
});

export default router;
