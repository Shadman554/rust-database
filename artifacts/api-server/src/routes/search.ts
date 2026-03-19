import { Router, type IRouter } from "express";
import { ilike, or } from "drizzle-orm";
import { db, wordsTable, diseasesTable, drugsTable, booksTable, instrumentsTable, testsTable, slidesTable, notesTable, normalRangesTable } from "@workspace/db";
import { parsePagination, buildPagination, toStr } from "../lib/pagination.js";

const router: IRouter = Router();

const ALLOWED_TYPES = new Set([
  "all", "dictionary", "diseases", "drugs", "books", "instruments",
  "tests", "slides", "notes", "normalRanges",
]);

const MAX_Q_LENGTH = 200;

router.get("/search", async (req, res): Promise<void> => {
  const q = toStr(req.query.q);
  const type = toStr(req.query.type) ?? "all";
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);

  if (!q) {
    res.status(400).json({ error: "q parameter is required" });
    return;
  }

  if (q.length > MAX_Q_LENGTH) {
    res.status(400).json({ error: `q parameter must be ${MAX_Q_LENGTH} characters or fewer` });
    return;
  }

  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: `Invalid type. Must be one of: ${[...ALLOWED_TYPES].join(", ")}` });
    return;
  }

  const runAll = type === "all";

  const [
    dictionary,
    diseases,
    drugs,
    books,
    instruments,
    tests,
    slides,
    notes,
    normalRanges,
  ] = await Promise.all([
    runAll || type === "dictionary"
      ? db.select().from(wordsTable)
          .where(or(ilike(wordsTable.name, `%${q}%`), ilike(wordsTable.kurdish, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "diseases"
      ? db.select().from(diseasesTable)
          .where(or(ilike(diseasesTable.name, `%${q}%`), ilike(diseasesTable.kurdish, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "drugs"
      ? db.select().from(drugsTable)
          .where(or(ilike(drugsTable.name, `%${q}%`), ilike(drugsTable.drugClass, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "books"
      ? db.select().from(booksTable)
          .where(or(ilike(booksTable.title, `%${q}%`), ilike(booksTable.author, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "instruments"
      ? db.select().from(instrumentsTable)
          .where(or(ilike(instrumentsTable.name, `%${q}%`), ilike(instrumentsTable.category, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "tests"
      ? db.select().from(testsTable)
          .where(or(ilike(testsTable.name, `%${q}%`), ilike(testsTable.species, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "slides"
      ? db.select().from(slidesTable)
          .where(or(ilike(slidesTable.name, `%${q}%`), ilike(slidesTable.species, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "notes"
      ? db.select().from(notesTable)
          .where(or(ilike(notesTable.name, `%${q}%`), ilike(notesTable.description, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
    runAll || type === "normalRanges"
      ? db.select().from(normalRangesTable)
          .where(or(ilike(normalRangesTable.parameter, `%${q}%`), ilike(normalRangesTable.species, `%${q}%`)))
          .limit(limit)
      : Promise.resolve([]),
  ]);

  const results = { dictionary, diseases, drugs, books, instruments, tests, slides, notes, normalRanges };
  const totalResults = Object.values(results).reduce((acc, arr) => acc + arr.length, 0);

  res.json({
    query: q,
    type,
    results,
    pagination: buildPagination(page, limit, totalResults),
  });
});

export default router;
