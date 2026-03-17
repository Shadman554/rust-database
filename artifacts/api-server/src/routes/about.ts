import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ceosTable, supportersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

// --- CEOs ---
router.get("/about/ceos", async (_req, res): Promise<void> => {
  const ceos = await db.select().from(ceosTable).orderBy(ceosTable.displayOrder);
  res.json(ceos);
});

router.post("/about/ceos", requireAuth, async (req, res): Promise<void> => {
  const { name, role, description, color, imageUrl, facebookUrl, viberUrl } = req.body as Record<string, string>;
  const displayOrder = req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : 0;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [created] = await db.insert(ceosTable).values({ name, role, description, color, imageUrl, facebookUrl, viberUrl, displayOrder }).returning();
  res.status(201).json(created);
});

router.put("/about/ceos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, role, description, color, imageUrl, facebookUrl, viberUrl } = req.body as Record<string, string>;
  const displayOrder = req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : undefined;

  const [updated] = await db
    .update(ceosTable)
    .set({ name, role, description, color, imageUrl, facebookUrl, viberUrl, ...(displayOrder !== undefined ? { displayOrder } : {}) })
    .where(eq(ceosTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "CEO not found" }); return; }
  res.json(updated);
});

router.delete("/about/ceos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(ceosTable).where(eq(ceosTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "CEO not found" }); return; }
  res.sendStatus(204);
});

// --- Supporters ---
router.get("/about/supporters", async (_req, res): Promise<void> => {
  const supporters = await db.select().from(supportersTable).orderBy(supportersTable.displayOrder);
  res.json(supporters);
});

router.post("/about/supporters", requireAuth, async (req, res): Promise<void> => {
  const { name, title, color, icon, imageUrl } = req.body as Record<string, string>;
  const displayOrder = req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : 0;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [created] = await db.insert(supportersTable).values({ name, title, color, icon, imageUrl, displayOrder }).returning();
  res.status(201).json(created);
});

router.put("/about/supporters/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, title, color, icon, imageUrl } = req.body as Record<string, string>;
  const displayOrder = req.body.displayOrder !== undefined ? Number(req.body.displayOrder) : undefined;

  const [updated] = await db
    .update(supportersTable)
    .set({ name, title, color, icon, imageUrl, ...(displayOrder !== undefined ? { displayOrder } : {}) })
    .where(eq(supportersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Supporter not found" }); return; }
  res.json(updated);
});

router.delete("/about/supporters/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(supportersTable).where(eq(supportersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Supporter not found" }); return; }
  res.sendStatus(204);
});

export default router;
