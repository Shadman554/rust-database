import { readFileSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import {
  wordsTable,
  diseasesTable,
  drugsTable,
  booksTable,
  instrumentsTable,
  testsTable,
  slidesTable,
  notesTable,
  normalRangesTable,
  notificationsTable,
  ceosTable,
  supportersTable,
} from "@workspace/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = resolve(__dirname, "../../attached_assets");
const BATCH_SIZE = 500;

function findFile(keyword: string): string | null {
  const files = readdirSync(ASSETS_DIR);
  const found = files.find((f) => f.startsWith(keyword) && f.endsWith(".json"));
  return found ? join(ASSETS_DIR, found) : null;
}

function readItems(keyword: string): any[] {
  const path = findFile(keyword);
  if (!path) {
    console.warn(`  [skip] No file found for: ${keyword}`);
    return [];
  }
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : (parsed.items ?? []);
}

async function batchInsert<T>(table: any, rows: T[], label: string) {
  if (!rows.length) { console.log(`  [skip] ${label}: 0 records`); return; }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(table).values(batch).onConflictDoNothing();
    inserted += batch.length;
  }
  console.log(`  [ok] ${label}: ${inserted} records`);
}

async function seedDictionary() {
  console.log("Seeding dictionary...");
  const items = readItems("dictionary_");
  const rows = items.map((r: any) => ({
    name: r.name ?? "",
    kurdish: r.kurdish ?? "",
    arabic: r.arabic ?? null,
    description: r.description || null,
  })).filter((r: any) => r.name && r.kurdish);
  await batchInsert(wordsTable, rows, "words");
}

async function seedDiseases() {
  console.log("Seeding diseases...");
  const items = readItems("diseases_");
  const rows = items.map((r: any) => ({
    name: r.name ?? "",
    kurdish: r.kurdish ?? null,
    symptoms: r.symptoms ?? null,
    cause: r.cause ?? null,
    control: r.control ?? null,
  })).filter((r: any) => r.name);
  await batchInsert(diseasesTable, rows, "diseases");
}

async function seedDrugs() {
  console.log("Seeding drugs...");
  const items = readItems("drugs_");
  const rows = items.map((r: any) => ({
    name: r.name ?? "",
    usage: r.usage ?? null,
    sideEffect: r.side_effect ?? null,
    otherInfo: r.other_info ?? null,
    drugClass: r.drug_class ?? null,
    tradeNames: r.trade_names || null,
    speciesDosages: r.species_dosages || null,
    contraindications: r.contraindications || null,
    drugInteractions: r.drug_interactions || null,
    withdrawalTimes: r.withdrawal_times || null,
  })).filter((r: any) => r.name);
  await batchInsert(drugsTable, rows, "drugs");
}

async function seedBooks() {
  console.log("Seeding books...");
  const items = readItems("books_");
  const rows = items.map((r: any) => ({
    title: r.title ?? "",
    author: r.author ?? null,
    isbn: r.isbn ?? null,
    description: r.description || null,
    category: r.category ?? null,
    coverUrl: r.cover_url || null,
    downloadUrl: r.download_url || null,
  })).filter((r: any) => r.title);
  await batchInsert(booksTable, rows, "books");
}

async function seedInstruments() {
  console.log("Seeding instruments...");
  const items = readItems("instruments_");
  const rows = items.map((r: any) => ({
    name: r.name ?? "",
    description: r.description ?? null,
    usage: r.usage ?? null,
    category: r.category ?? null,
    imageUrl: r.image_url ?? null,
  })).filter((r: any) => r.name);
  await batchInsert(instrumentsTable, rows, "instruments");
}

async function seedTests() {
  console.log("Seeding tests...");
  const categories: { file: string; category: string }[] = [
    { file: "haematology_tests_", category: "haematology" },
    { file: "serology_tests_", category: "serology" },
    { file: "bacteriology_tests_", category: "bacteriology" },
    { file: "biochemistry_tests_", category: "biochemistry" },
    { file: "other_tests_", category: "other" },
  ];
  const allRows: any[] = [];
  for (const { file, category } of categories) {
    const items = readItems(file);
    const rows = items.map((r: any) => ({
      name: r.name ?? "",
      description: r.description ?? null,
      imageUrl: r.image_url ?? null,
      category,
      species: r.species ?? null,
    })).filter((r: any) => r.name);
    allRows.push(...rows);
    console.log(`  ${category}: ${rows.length} items`);
  }
  await batchInsert(testsTable, allRows, "tests (all categories)");
}

async function seedSlides() {
  console.log("Seeding slides...");
  const categories: { file: string; category: string }[] = [
    { file: "urine_slide_", category: "urine" },
    { file: "stool_slide_", category: "stool" },
    { file: "other_slide_", category: "other" },
  ];
  const allRows: any[] = [];
  for (const { file, category } of categories) {
    const items = readItems(file);
    const rows = items.map((r: any) => ({
      name: r.name ?? "",
      species: r.species ?? null,
      imageUrl: r.image_url ?? null,
      category,
    })).filter((r: any) => r.name);
    allRows.push(...rows);
    console.log(`  ${category}: ${rows.length} items`);
  }
  await batchInsert(slidesTable, allRows, "slides (all categories)");
}

async function seedNotes() {
  console.log("Seeding notes...");
  const items = readItems("notes_");
  const rows = items.map((r: any) => ({
    name: r.name ?? "",
    description: r.description ?? null,
    imageUrl: r.image_url ?? null,
  })).filter((r: any) => r.name);
  await batchInsert(notesTable, rows, "notes");
}

async function seedNormalRanges() {
  console.log("Seeding normal ranges...");
  const items = readItems("normal_ranges_");
  const rows = items.map((r: any) => ({
    name: r.name ?? null,
    parameter: r.parameter ?? "",
    species: r.species ?? "",
    category: r.category ?? null,
    minValue: r.min_value !== undefined && r.min_value !== null && r.min_value !== "" ? parseFloat(String(r.min_value)) : null,
    maxValue: r.max_value !== undefined && r.max_value !== null && r.max_value !== "" ? parseFloat(String(r.max_value)) : null,
    unit: r.unit ?? null,
    description: r.description ?? null,
    reference: r.reference ?? null,
    note: r.note || null,
    panicLow: r.panic_low || null,
    panicHigh: r.panic_high || null,
  })).filter((r: any) => r.parameter && r.species);
  await batchInsert(normalRangesTable, rows, "normal_ranges");
}

async function seedNotifications() {
  console.log("Seeding notifications...");
  const items = readItems("notifications_");
  const rows = items.map((r: any) => ({
    title: r.title ?? "",
    body: r.body ?? null,
    imageUrl: r.image_url ?? null,
    type: r.type ?? "general",
    isRead: r.is_read ?? false,
  })).filter((r: any) => r.title);
  await batchInsert(notificationsTable, rows, "notifications");
}

async function main() {
  console.log("=== VetStan Database Seed ===\n");

  await seedDictionary();
  await seedDiseases();
  await seedDrugs();
  await seedBooks();
  await seedInstruments();
  await seedTests();
  await seedSlides();
  await seedNotes();
  await seedNormalRanges();
  await seedNotifications();

  console.log("\n=== Seed complete! ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
