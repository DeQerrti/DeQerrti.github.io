#!/usr/bin/env node
// Достаёт номера тайтлов в чужих базах из уже сохранённых ссылок на
// обложки и складывает их в поле ids каждого отзыва.
//
// Зачем это нужно — см. шапку js/external-ids.js. Коротко: импорт
// списков с Шикимори сходится по номерам, а не по названиям.
//
// Сеть не нужна: всё берётся из того, что уже лежит в reviews.json.
// Номера, которых в ссылках нет (TMDB, IGDB), достаются отдельно —
// scripts/enrich-ids.js, ему нужен интернет.
//
// Запуск:
//   node scripts/extract-ids.js            — показать, что найдётся
//   node scripts/extract-ids.js --write    — записать в reviews.json
//
// Повторный запуск безопасен: уже проставленные номера не трогаются.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBrowserScript } from "./load-browser-script.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "reviews.json");

const { extractIdsFromCover, mergeIds } = loadBrowserScript("js/external-ids.js", [
  "extractIdsFromCover",
  "mergeIds",
]);

const write = process.argv.includes("--write");
const reviews = JSON.parse(readFileSync(FILE, "utf8"));

const added = {};
const already = {};
let touched = 0;
const withoutAny = [];

for (const review of reviews) {
  const found = extractIdsFromCover(review.cover);
  const before = review.ids || {};

  for (const key of Object.keys(found)) {
    if (before[key] !== undefined) already[key] = (already[key] || 0) + 1;
    else added[key] = (added[key] || 0) + 1;
  }

  const merged = mergeIds(before, found);
  if (Object.keys(merged).length) {
    if (JSON.stringify(merged) !== JSON.stringify(before)) touched++;
    review.ids = merged;
  } else {
    withoutAny.push(`${review.type} — ${review.title}`);
  }
}

const pad = (n) => String(n).padStart(4);
console.log(`Отзывов всего: ${reviews.length}\n`);
console.log("Найдено новых номеров:");
for (const [key, count] of Object.entries(added).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(count)}  ${key}`);
}
if (!Object.keys(added).length) console.log("     — ничего нового");

if (Object.keys(already).length) {
  console.log("\nУже стояли (не тронуты):");
  for (const [key, count] of Object.entries(already).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(count)}  ${key}`);
  }
}

console.log(`\nБез единого номера: ${withoutAny.length}`);
if (withoutAny.length) {
  for (const line of withoutAny.slice(0, 8)) console.log(`     ${line}`);
  if (withoutAny.length > 8) console.log(`     …и ещё ${withoutAny.length - 8}`);
  console.log("\n  Это те, где обложка не из базы с номером в ссылке");
  console.log("  (TMDB и IGDB прячут номер тайтла) или её вовсе нет.");
  console.log("  Для них — scripts/enrich-ids.js, ему нужен интернет.");
}

if (write) {
  // Тем же способом, что и админка (functions/_shared.js): два пробела
  // отступа и без завершающего перевода строки, иначе каждое сохранение
  // с сайта давало бы лишний diff.
  writeFileSync(FILE, JSON.stringify(reviews, null, 2), "utf8");
  console.log(`\nЗаписано в reviews.json: изменено отзывов — ${touched}`);
} else {
  console.log("\nЭто был просмотр. Чтобы записать: node scripts/extract-ids.js --write");
}
