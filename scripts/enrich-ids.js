#!/usr/bin/env node
// Дозапрашивает у AniList номер того же тайтла на MyAnimeList и
// дописывает его в ids каждого отзыва.
//
// Зачем именно MAL. Шикимори использует маловские номера напрямую:
// запись 38000 у него — та же запись 38000 на MAL. Поэтому когда
// дойдёт до импорта списка с Шикимори, сходиться всё будет по mal,
// а не по anilist. AniList хранит этот номер рядом со своим, в поле
// idMal, и отдаёт его без всякого ключа — этим и пользуемся.
//
// Что НЕ делает: не ищет номера для TMDB и IGDB. Их API требуют
// ключей (у IGDB — ещё и OAuth через Twitch), а номер тайтла в
// ссылке на обложку у них не лежит. Это отдельная задача.
//
// Нужен интернет. Запуск:
//   node scripts/enrich-ids.js            — показать, что запросится
//   node scripts/enrich-ids.js --write    — запросить и записать
//
// Повторный запуск безопасен: спрашиваются только те отзывы, у
// которых есть anilist и ещё нет mal.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "reviews.json");

const ENDPOINT = "https://graphql.anilist.co";
const BATCH = 50; // AniList отдаёт до 50 записей за страницу
const PAUSE_MS = 1500; // у них 90 запросов в минуту — с запасом

const write = process.argv.includes("--write");
const reviews = JSON.parse(readFileSync(FILE, "utf8"));

const pending = reviews.filter((r) => r.ids?.anilist && !r.ids?.mal);
const uniqueIds = [...new Set(pending.map((r) => r.ids.anilist))];

console.log(`Отзывов с номером AniList и без номера MAL: ${pending.length}`);
console.log(`Уникальных номеров для запроса: ${uniqueIds.length}`);
console.log(`Запросов к AniList: ${Math.ceil(uniqueIds.length / BATCH)}\n`);

if (!uniqueIds.length) {
  console.log("Запрашивать нечего — всё уже проставлено.");
  process.exit(0);
}

if (!write) {
  console.log("Это был просмотр. Чтобы запросить и записать:");
  console.log("  node scripts/enrich-ids.js --write");
  process.exit(0);
}

const QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids) {
        id
        idMal
      }
    }
  }
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBatch(ids) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { ids } }),
  });

  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after") || 60);
    console.log(`  превышен лимит запросов, ждём ${wait}с…`);
    await sleep(wait * 1000);
    return fetchBatch(ids);
  }
  if (!res.ok) {
    throw new Error(`AniList ответил ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = await res.json();
  if (body.errors) {
    throw new Error(`AniList вернул ошибку: ${JSON.stringify(body.errors).slice(0, 200)}`);
  }
  return body.data.Page.media;
}

const malByAnilist = new Map();
let noMal = 0;

for (let i = 0; i < uniqueIds.length; i += BATCH) {
  const chunk = uniqueIds.slice(i, i + BATCH);
  process.stdout.write(`Запрос ${Math.floor(i / BATCH) + 1}: ${chunk.length} номеров… `);
  const media = await fetchBatch(chunk);
  for (const item of media) {
    // idMal бывает null: у записей, которых на MAL нет вовсе.
    if (item.idMal) malByAnilist.set(item.id, item.idMal);
    else noMal++;
  }
  console.log(`получено ${media.length}`);
  if (i + BATCH < uniqueIds.length) await sleep(PAUSE_MS);
}

let filled = 0;
for (const review of reviews) {
  const mal = malByAnilist.get(review.ids?.anilist);
  if (mal && !review.ids.mal) {
    review.ids.mal = mal;
    filled++;
  }
}

// Формат тот же, что пишет админка (functions/_shared.js).
writeFileSync(FILE, JSON.stringify(reviews, null, 2), "utf8");

console.log(`\nПроставлено номеров MAL: ${filled}`);
if (noMal) console.log(`Без номера на MAL (такой записи там нет): ${noMal}`);
