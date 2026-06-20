// ══════════════════════════════════════════════
//  BACKUP — кнопка скачивания бэкапа JSON-данных
//  Подключать на всех админских страницах.
//  Зависит от: JSZip (CDN, должен быть подключён раньше этого файла)
// ══════════════════════════════════════════════

(function () {
  const FILES = [
    { path: "/reviews.json", name: "reviews.json" },
    { path: "/favorites.json", name: "favorites.json" },
    { path: "/characters-tier.json", name: "characters-tier.json" },
  ];

  function injectButton() {
    const btn = document.createElement("button");
    btn.id = "backup-btn";
    btn.textContent = "⤓ Бэкап";
    btn.title = "Скачать reviews.json + favorites.json + characters-tier.json одним архивом";

    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "9999",
      padding: ".6rem 1.1rem",
      background: "var(--surface2, #1a1a1f)",
      border: "1px solid var(--border2, #333338)",
      borderRadius: "6px",
      color: "var(--text, #b8b0a8)",
      fontFamily: "'DM Sans', sans-serif",
      fontSize: ".85rem",
      letterSpacing: ".03em",
      cursor: "pointer",
      transition: "all .2s ease",
    });
    btn.onmouseenter = () => {
      btn.style.borderColor = "var(--green-hi, #6ab87a)";
      btn.style.color = "var(--text-hi, #f0ece6)";
    };
    btn.onmouseleave = () => {
      btn.style.borderColor = "var(--border2, #333338)";
      btn.style.color = "var(--text, #b8b0a8)";
    };

    btn.addEventListener("click", () => downloadBackup(btn));
    document.body.appendChild(btn);
  }

  async function downloadBackup(btn) {
    const originalText = btn.textContent;
    btn.textContent = "⤓ Собираю...";
    btn.disabled = true;

    try {
      if (typeof JSZip === "undefined") {
        throw new Error("JSZip не загружен");
      }

      const zip = new JSZip();

      const results = await Promise.all(
        FILES.map(f =>
          fetch(f.path + "?_=" + Date.now())
            .then(r => {
              if (!r.ok) throw new Error(`${f.name}: HTTP ${r.status}`);
              return r.text();
            })
            .then(text => ({ name: f.name, text }))
        )
      );

      results.forEach(({ name, text }) => zip.file(name, text));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasteid-backup-${date}.zip`;
      link.click();

      URL.revokeObjectURL(url);

      btn.textContent = "✓ Готово";
    } catch (err) {
      console.error("Backup failed:", err);
      btn.textContent = "✗ Ошибка";
      alert("Не удалось собрать бэкап 😢\n" + err.message);
    } finally {
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
})();
