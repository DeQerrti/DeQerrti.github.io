// Загрузка обычного браузерного файла из js/ внутрь node-скрипта.
//
// В js/ лежат не модули, а простые <script>: они кладут функции в
// глобальную область страницы. package.json при этом объявляет
// "type": "module", так что ни import, ни require такой файл не берут.
//
// Дублировать логику в scripts/ нельзя — она разъедется с той, что
// работает на сайте, и скрипт начнёт находить не то, что форма
// сохраняет. Поэтому файл читается как текст и выполняется, а наружу
// отдаются перечисленные имена.
//
// Годится только для своих файлов из этого репозитория.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadBrowserScript(relativePath, names) {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  const factory = new Function(`${source}\nreturn { ${names.join(", ")} };`);
  return factory();
}
