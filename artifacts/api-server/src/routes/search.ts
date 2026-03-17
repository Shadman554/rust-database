import { Router, type IRouter } from "express";
import { ilike, or } from "drizzle-orm";
import { db, wordsTable, diseasesTable, drugsTable, booksTable, instrumentsTable, testsTable, slidesTable, notesTable, normalRangesTable } from "@workspace/db";
import { parsePagination, buildPagination } from "../lib/pagination.js";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const q = req.query.q as string;
  const type = (req.query.type as string) ?? "all";
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);

  if (!q) {
    res.status(400).json({ error: "q parameter is required" });
    return;
  }

  const results: Record<string, unknown[]> = {
    dictionary: [],
    diseases: [],
    drugs: [],
    books: [],
    instruments: [],
    tests: [],
    slides: [],
    notes: [],
    normalRanges: [],
  };

  const runSearch = type === "all";

  if (runSearch || type === "dictionary") {
    results.dictionary = await db.select().from(wordsTable)
      .where(or(ilike(wordsTable.word, `%${q}%`), ilike(wordsTable.kurdishMeaning, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "diseases") {
    results.diseases = await db.select().from(diseasesTable)
      .where(or(ilike(diseasesTable.name, `%${q}%`), ilike(diseasesTable.kurdish, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "drugs") {
    results.drugs = await db.select().from(drugsTable)
      .where(or(ilike(drugsTable.name, `%${q}%`), ilike(drugsTable.drugClass, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "books") {
    results.books = await db.select().from(booksTable)
      .where(or(ilike(booksTable.title, `%${q}%`), ilike(booksTable.author, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "instruments") {
    results.instruments = await db.select().from(instrumentsTable)
      .where(or(ilike(instrumentsTable.name, `%${q}%`), ilike(instrumentsTable.category, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "tests") {
    results.tests = await db.select().from(testsTable)
      .where(or(ilike(testsTable.name, `%${q}%`), ilike(testsTable.species, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "slides") {
    results.slides = await db.select().from(slidesTable)
      .where(or(ilike(slidesTable.name, `%${q}%`), ilike(slidesTable.species, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "notes") {
    results.notes = await db.select().from(notesTable)
      .where(or(ilike(notesTable.name, `%${q}%`), ilike(notesTable.description, `%${q}%`)))
      .limit(limit);
  }
  if (runSearch || type === "normalRanges") {
    results.normalRanges = await db.select().from(normalRangesTable)
      .where(or(ilike(normalRangesTable.parameter, `%${q}%`), ilike(normalRangesTable.species, `%${q}%`)))
      .limit(limit);
  }

  const totalResults = Object.values(results).reduce((acc, arr) => acc + arr.length, 0);

  res.json({
    query: q,
    type,
    results,
    pagination: buildPagination(page, limit, totalResults),
  });
});

export default router;
