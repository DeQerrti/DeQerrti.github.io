// ══════════════════════════════════════════════
//  THEME — применение цветовой темы и акцентного
//  цвета из site-settings.json поверх :root в style.css
//  Подключать РАНО в <head>, до основного контента —
//  тогда переопределение цветов происходит без "мигания".
// ══════════════════════════════════════════════

const THEME_PRESETS = {
  classic: {
    label: "Классический",
    "--bg": "#0a0a0c", "--bg2": "#0f0f12",
    "--surface": "#111114", "--surface2": "#1a1a1f",
    "--border": "#222228", "--border2": "#333338",
    "--text": "#b8b0a8", "--text-dim": "#4a4540", "--text-hi": "#f0ece6",
  },
  midnight: {
    label: "Полночный индиго",
    "--bg": "#06070f", "--bg2": "#0a0c1c",
    "--surface": "#0f1228", "--surface2": "#181c3a",
    "--border": "#242a52", "--border2": "#363d72",
    "--text": "#a8acd8", "--text-dim": "#3e4270", "--text-hi": "#e6e8fa",
  },
  graphite: {
    label: "Тёплый графит",
    "--bg": "#0f0b08", "--bg2": "#180f0a",
    "--surface": "#1c140d", "--surface2": "#2c1f13",
    "--border": "#3a2a18", "--border2": "#523a22",
    "--text": "#c9a97e", "--text-dim": "#5c4326", "--text-hi": "#f5e2c4",
  },
  emerald: {
    label: "Глубокий изумруд",
    "--bg": "#050a07", "--bg2": "#08130d",
    "--surface": "#0d1811", "--surface2": "#15271b",
    "--border": "#1f3a29", "--border2": "#2c5539",
    "--text": "#8fc4a3", "--text-dim": "#2f5a3f", "--text-hi": "#dcf5e6",
  },
  // Прототип: не только своя палитра, но и другой визуальный язык —
  // скруглённые карточки, мягкие тени, крупные курсивные заголовки.
  // Структурные отличия (не сводимые к цвету) живут в CSS под
  // [data-skin="soft"] — см. index.html. defaultAccent подставляется,
  // только если человек ещё не задал свой акцент вручную.
  soft: {
    label: "Мягкий ботанический",
    skin: "soft",
    defaultAccent: "#6b7f4a",
    "--bg": "#f2ece0", "--bg2": "#ece4d2",
    "--surface": "#f1efdc", "--surface2": "#e2e5c6",
    "--border": "#d7d0ac", "--border2": "#bfbd8e",
    "--text": "#6b6552", "--text-dim": "#a89f88", "--text-hi": "#332f22",
    "--radius-btn": "999px",
    // Карточки на Главной/тир-листе — скругление и мягкая тень вместо
    // резких уголков-скобок из классической темы.
    "--card-radius": "22px",
    "--card-border": "none",
    "--card-shadow": "0 12px 30px -14px rgba(60,50,20,.35)",
    "--card-shadow-hover": "0 18px 38px -14px rgba(60,50,20,.42)",
    "--card-corner-display": "none",
    "--card-img-filter": "none",
    "--card-img-filter-hover": "none",
    // Бейджи (тип/дата в углах карточек) — были тёмными как в классической
    // теме и сливались с обложками; здесь — авокадовые полупрозрачные,
    // с тёмным текстом, читаемым на светлом фоне.
    "--badge-bg": "rgba(139,166,102,.55)",
    "--badge-text": "#2c2a1c",
    "--badge-text-dim": "#2c2a1c",
    "--badge-border": "rgba(139,166,102,.6)",
    "--badge-accent-border": "rgba(139,166,102,.6)",
  },
};

const DEFAULT_ACCENT = "#8b1a1a"; // текущий --red по умолчанию

// Строим hi/dim-варианты акцентного цвета через регулировку светлоты (HSL)
function accentVariants(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return {
    "--red": hex,
    "--red-hi": hslToHex(h, s, Math.min(l + 18, 92)),
    "--red-dim": hslToHex(h, s, Math.max(l - 18, 6)),
  };
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.substring(0, 2), 16),
    g: parseInt(m.substring(2, 4), 16),
    b: parseInt(m.substring(4, 6), 16),
  };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h, s;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function applyTheme() {
  let settings = {};
  try {
    const res = await fetch("site-settings.json");
    if (res.ok) settings = await res.json();
  } catch {
    // нет файла/сети — просто остаёмся на теме и подписях по умолчанию
  }

  const preset = THEME_PRESETS[settings.theme] || null;
  const accent = accentVariants(settings.customAccent || preset?.defaultAccent || DEFAULT_ACCENT);
  const vars = { ...(preset || {}), ...accent };

  document.documentElement.setAttribute("data-skin", preset?.skin || "classic");

  const declarations = Object.entries(vars)
    .filter(([key]) => key.startsWith("--"))
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");

  const style = document.createElement("style");
  style.textContent = `:root { ${declarations} }`;
  document.head.appendChild(style);

  window.SITE_LABELS = mergeLabels(settings.labels);
  window.SITE_LABEL_OVERRIDES = settings.labels || {};
  window.SITE_CUSTOM_TAGS = settings.customTags || {};
  window.SITE_CUSTOM_TYPES = settings.customTypes || {};
  window.SITE_HIDDEN_TYPES = settings.hiddenTypes || [];
  window.SITE_CUSTOM_TYPE_PLURAL = settings.customTypePlural || {};
  window.SITE_CUSTOM_SOURCES = settings.customSources || {};
  window.SITE_CUSTOM_CATEGORIES = settings.customCategories || {};
  window.SITE_CATEGORY_COLORS = settings.categoryColors || {};
  window.SITE_GRADE_SCALE = settings.gradeScale || null;
  window.SITE_STATUS_BUCKETS = settings.statusBuckets || null;
  window.SITE_HIDDEN_STATUSES = new Set(settings.hiddenStatuses || []);
  window.SITE_TIER_COLLECTIONS = settings.tierCollections || null;
  window.SITE_HIDDEN_STATS = new Set(settings.hiddenStatsBlocks || []);
  // Дальше идёт работа с DOM — ждём, пока разметка вообще появится.
  // Цвета выше применяются сразу, не дожидаясь этого, иначе будет
  // видно мигание темы по умолчанию.
  await domReady();

  applyNavLabels();
  applyTabPreferences(settings);

  // Событие шлём последним: к этому моменту и подписи, и порядок вкладок
  // уже на месте, а слушатели (config.js, now.js) точно зарегистрированы —
  // они объявлены в скриптах, которые до DOMContentLoaded успевают
  // выполниться даже если стоят в конце <body>.
  document.dispatchEvent(new CustomEvent("site-labels-ready"));
}

// Промис готовности DOM — чтобы не писать одну и ту же ветку readyState
// по четыре раза.
function domReady() {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) =>
    document.addEventListener("DOMContentLoaded", resolve, { once: true })
  );
}

// ── Порядок вкладок, скрытые вкладки и стартовая вкладка ──
// Всё это настраивается в /settings-edit и хранится в site-settings.json
// (tabOrder / hiddenTabs / mainTab). Раньше публичная страница читала
// только hiddenTabs, а порядок и стартовую вкладку игнорировала —
// настройки сохранялись, но ни на что не влияли.
//
// Итоговую стартовую вкладку кладём в window.SITE_INITIAL_TAB: сама
// активация — за index.html, который знает про switchTab().
function applyTabPreferences(settings) {
  const nav = document.querySelector("nav");
  const buttons = Array.from(document.querySelectorAll("[data-label^='nav.']"));
  if (!buttons.length) return;

  const idOf = (btn) => btn.getAttribute("data-label").split(".")[1];
  const byId = new Map(buttons.map((btn) => [idOf(btn), btn]));
  const hidden = new Set(settings.hiddenTabs || []);

  // Порядок: сначала то, что задано явно, затем всё остальное — в том
  // порядке, в каком оно лежит в разметке. Незнакомые id из настроек
  // игнорируются сами собой (byId.has отсеивает).
  const order = (settings.tabOrder || []).filter((id) => byId.has(id));
  const rest = buttons.map(idOf).filter((id) => !order.includes(id));
  const finalOrder = [...order, ...rest];

  if (nav) finalOrder.forEach((id) => nav.appendChild(byId.get(id)));

  finalOrder.forEach((id) => {
    byId.get(id).hidden = hidden.has(id);
  });

  const visible = finalOrder.filter((id) => !hidden.has(id));
  const wanted = settings.mainTab;
  window.SITE_INITIAL_TAB =
    wanted && visible.includes(wanted) ? wanted : visible[0] || null;
}

// ── Подписи интерфейса ─────────────────────────
// Всё, что человек видит на сайте и может захотеть назвать по-своему.
// Значения по умолчанию лежат здесь, переопределения — в разделе
// «Подписи» в /settings-edit, откуда попадают в site-settings.json.
//
// Смысл в том, чтобы владелец сайта не упирался в чужие формулировки:
// «Шкала послевкусия» хороша для авторской шкалы оценок и странно
// смотрится при 10-балльной, «тайтл» уместен для аниме и не уместен,
// если человек ведёт только книги.
//
// Читать через siteLabel(группа, ключ, запасное значение) — если ключа
// в настройках нет, вернётся значение отсюда.
const DEFAULT_LABELS = {
  nav: { now: "Главная", favorites: "Любимое", reviews: "Отзывы", stats: "Статистика", tierlist: "Тир-лист" },
  statuses: { current: "В процессе", onhold: "Отложено", planning: "Планирую", archive: "Архив" },

  // Шапка сайта. Само название — бренд и здесь не настраивается.
  site: { subtitle: "Цифровой паспорт интересов" },

  // Заголовки блоков на вкладке «Любимое»
  sections: {
    favTitles: "Тайтлы",
    favCharacters: "Персонажи",
    favPersons: "Персоны",
    tierTitles: "Тайтлы",
  },

  // Панель фильтров на вкладке «Отзывы»
  filters: { search: "Поиск", type: "Тип", grade: "Оценка", source: "Ссылки", all: "Все" },

  // Заголовки блоков статистики
  stats: {
    total: "Всего",
    completed: "завершено",
    types: "Разбивка по типам",
    grades: "Шкала послевкусия",
    rewatch: "Пересмотры",
    tags: "Частые теги в отзывах",
    watchYears: "По годам просмотра",
    releaseYears: "По годам выхода",
    // Подпись под числом пересмотров, три формы под склонение
    rewatchOne: "тайтл пересмотрен",
    rewatchFew: "тайтла пересмотрено",
    rewatchMany: "тайтлов пересмотрено",
    // Блок «лучшее за год», {year} подставляется
    spotlightOne: "Тайтл {year} года",
    spotlightMany: "Тайтлы {year} года",
    // Когда за выбранный год ничего не завершено
    emptyYear: "За {year} год пока нет завершённых с оценкой",
  },

  // Общее слово для единицы коллекции — в трёх формах для склонения.
  // Используется там, где тип не важен: «233 тайтла», «12 тайтлов».
  units: { one: "тайтл", few: "тайтла", many: "тайтлов" },

  // Тексты, когда показывать нечего
  empty: {
    generic: "Пока пусто",
    list: "Список пуст",
    reviews: "Отзывов пока нет.",
    search: "Ничего не найдено",
  },
};

// Три формы единицы коллекции — удобная обёртка, чтобы не писать
// siteLabel("units", …) по три раза подряд.
function unitForms() {
  return [
    siteLabel("units", "one", DEFAULT_LABELS.units.one),
    siteLabel("units", "few", DEFAULT_LABELS.units.few),
    siteLabel("units", "many", DEFAULT_LABELS.units.many),
  ];
}

function mergeLabels(overrides) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_LABELS));
  if (overrides) {
    for (const group of Object.keys(merged)) {
      if (overrides[group]) Object.assign(merged[group], overrides[group]);
    }
  }
  return merged;
}

// Используется другими скриптами (например, now.js) для чтения подписи
// с учётом переопределений — если SITE_LABELS ещё не загрузился, просто
// отдаёт запасное значение, ничего не ломается.
function siteLabel(group, key, fallback) {
  return (window.SITE_LABELS && window.SITE_LABELS[group] && window.SITE_LABELS[group][key]) || fallback;
}

// Используется stats.js, чтобы решить, показывать ли конкретный блок
// статистики — управляется из /settings-edit.
function isStatVisible(key) {
  return !(window.SITE_HIDDEN_STATS && window.SITE_HIDDEN_STATS.has(key));
}

function applyNavLabels() {
  document.querySelectorAll("[data-label]").forEach((el) => {
    const path = el.getAttribute("data-label").split(".");
    let value = window.SITE_LABELS;
    for (const key of path) value = value && value[key];
    if (value) el.textContent = value;
  });
}

// Промис выставляем наружу: index.html дожидается его, чтобы не рисовать
// первую вкладку до того, как станет известно, какая вкладка стартовая.
// Ошибку глушим — сайт обязан открыться даже без site-settings.json.
window.themeReady = applyTheme().catch((err) => {
  console.warn("[theme] настройки не применились:", err);
});
