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
    "--bg": "#0a0a10", "--bg2": "#0e0e16",
    "--surface": "#121220", "--surface2": "#1a1a2c",
    "--border": "#22222e", "--border2": "#333348",
    "--text": "#b0b0c0", "--text-dim": "#454558", "--text-hi": "#eceef8",
  },
  graphite: {
    label: "Тёплый графит",
    "--bg": "#0c0b0a", "--bg2": "#12100e",
    "--surface": "#16130f", "--surface2": "#201c16",
    "--border": "#282019", "--border2": "#3a2f24",
    "--text": "#b8ada0", "--text-dim": "#4a4038", "--text-hi": "#f0e6dc",
  },
  emerald: {
    label: "Глубокий изумруд",
    "--bg": "#0a0c0b", "--bg2": "#0e120f",
    "--surface": "#111512", "--surface2": "#1a221c",
    "--border": "#20281f", "--border2": "#2f3d2d",
    "--text": "#aebab0", "--text-dim": "#40483f", "--text-hi": "#e8f0e6",
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
  let h, s, l = (max + min) / 2;
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
  const accent = accentVariants(settings.customAccent || DEFAULT_ACCENT);
  const vars = { ...(preset || {}), ...accent };

  const declarations = Object.entries(vars)
    .filter(([key]) => key.startsWith("--"))
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");

  const style = document.createElement("style");
  style.textContent = `:root { ${declarations} }`;
  document.head.appendChild(style);

  window.SITE_LABELS = mergeLabels(settings.labels);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyNavLabels);
  } else {
    applyNavLabels();
  }
  document.dispatchEvent(new CustomEvent("site-labels-ready"));
}

// ── Подписи (вкладки, статусы) — переопределяются из site-settings.json,
//    но всегда есть разумные значения по умолчанию, если файла/полей нет ──
const DEFAULT_LABELS = {
  nav: { now: "Главная", favorites: "Любимое", reviews: "Отзывы", stats: "Статистика", tierlist: "Тир-лист" },
  statuses: { current: "В процессе", onhold: "Отложено", planning: "Планирую", archive: "Архив" },
};

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

function applyNavLabels() {
  document.querySelectorAll("[data-label]").forEach((el) => {
    const path = el.getAttribute("data-label").split(".");
    let value = window.SITE_LABELS;
    for (const key of path) value = value && value[key];
    if (value) el.textContent = value;
  });
}

applyTheme();
