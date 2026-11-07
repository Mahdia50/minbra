#!/usr/bin/env node
/**
 * Compiles .seed/part*.txt  ->  supabase/migrations/0003_seed.sql
 *
 * Input line format (pipe separated, 7 fields):
 *   slug|category_name_ar|category_name_darija|emoji|word_ar|word_darija|difficulty
 *
 * The generated file is deterministic, so re-running it produces no diff.
 *
 *   node scripts/build-seed.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = join(root, ".seed");
const outFile = join(root, "supabase", "migrations", "0003_seed.sql");
const CHUNK = 900;

const files = readdirSync(seedDir).filter((f) => f.endsWith(".txt")).sort();
if (files.length === 0) {
  console.error("No .seed/*.txt files found.");
  process.exit(1);
}

/** @type {Map<string, {slug:string, nameAr:string, nameDarija:string, emoji:string, order:number}>} */
const categories = new Map();
/** @type {Array<{slug:string,ar:string,darija:string,difficulty:number}>} */
const words = [];
const seen = new Set();

for (const file of files) {
  const lines = readFileSync(join(seedDir, file), "utf8").split("\n");
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split("|");
    if (parts.length !== 7) {
      throw new Error(`${file}:${idx + 1} expected 7 fields, got ${parts.length}`);
    }
    const [slug, nameAr, nameDarija, emoji, ar, darija, difficultyRaw] = parts.map((p) => p.trim());
    const difficulty = Number(difficultyRaw);
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${file}:${idx + 1} bad slug "${slug}"`);
    if (![1, 2, 3].includes(difficulty)) throw new Error(`${file}:${idx + 1} bad difficulty "${difficultyRaw}"`);
    if (!ar || !darija) throw new Error(`${file}:${idx + 1} empty word`);

    if (!categories.has(slug)) {
      categories.set(slug, { slug, nameAr, nameDarija, emoji, order: categories.size + 1 });
    }

    const key = `${slug}::${ar}`;
    if (seen.has(key)) return; // silently drop duplicates, keep the seed idempotent
    seen.add(key);
    words.push({ slug, ar, darija, difficulty });
  });
}

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const header = `-- ============================================================================
--  «مين برّة السالفة»  —  0003 : Word bank seed
--
--  GENERATED FILE — do not edit by hand.
--  Rebuild with:  node scripts/build-seed.mjs
--
--  Categories: ${categories.size}
--  Words:      ${words.length}
-- ============================================================================

set search_path = public;
`;

const categoryValues = [...categories.values()]
  .map((c) => `  (${q(c.slug)}, ${q(c.nameAr)}, ${q(c.nameDarija)}, ${q(c.emoji)}, ${c.order})`)
  .join(",\n");

const categorySql = `
-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name_ar, name_darija, emoji, sort_order) values
${categoryValues}
on conflict (slug) do update
  set name_ar     = excluded.name_ar,
      name_darija = excluded.name_darija,
      emoji       = excluded.emoji,
      sort_order  = excluded.sort_order;
`;

const chunks = [];
for (let i = 0; i < words.length; i += CHUNK) {
  const slice = words.slice(i, i + CHUNK);
  const values = slice
    .map((w) => `  (${q(w.slug)}, ${q(w.ar)}, ${q(w.darija)}, ${w.difficulty})`)
    .join(",\n");
  chunks.push(`
-- words ${i + 1} – ${i + slice.length}
with data (slug, text_ar, text_darija, difficulty) as (
  values
${values}
)
insert into public.words (category_id, text_ar, text_darija, difficulty)
select c.id, d.text_ar, d.text_darija, d.difficulty
from data d
join public.categories c on c.slug = d.slug
where not exists (
  select 1 from public.words w
  where w.category_id = c.id and w.text_ar = d.text_ar
);`);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, header + categorySql + chunks.join("\n") + "\n", "utf8");

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
const perCategory = new Map();
for (const w of words) perCategory.set(w.slug, (perCategory.get(w.slug) ?? 0) + 1);

const counts = [...perCategory.values()];
const min = Math.min(...counts);
const max = Math.max(...counts);

console.log(`categories : ${categories.size}`);
console.log(`words      : ${words.length}`);
console.log(`per cat    : min ${min} / max ${max}`);
console.log(`written    : ${outFile.replace(root + "/", "")}`);

const thin = [...perCategory.entries()].filter(([, n]) => n < 100);
if (thin.length) {
  console.warn(`\nWARNING — ${thin.length} category(ies) below 100 words:`);
  for (const [slug, n] of thin) console.warn(`  ${slug}: ${n}`);
}
if (words.length < 5000) {
  console.warn(`\nWARNING — total word count ${words.length} is below the 5000 target.`);
}
