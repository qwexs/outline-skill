---
name: outline
description: Work with Outline Wiki (your-outline.example.com) - search, read, create, update, list documents and collections, manage file attachments. Use when working with wiki documentation, knowledge base articles, or team documentation management.
---

# Outline Wiki Skill

Skill для работы с Outline Wiki (your-outline.example.com) — поиск, создание, чтение, обновление и управление документацией и вложениями.

## 🎯 Что умеет

- **Поиск** — full-text search по всей wiki с контекстными сниппетами и breadcrumbs
- **Чтение** — получение документов по ID + path (`Collection / Parent / Doc`)
- **Создание** — новых документов и коллекций (`--file`, stdin, `--text` или `--template-id`)
- **Обновление** — replace/append/prepend/**patch** (`--text-file` / stdin / `--text`; `editMode` + `findText`, как в official MCP)
- **Шаблоны** — `templates.js` list/info + create из template
- **Коллекции** — create + **update** (`update-collection.js`: name/description/color/icon/private/public)
- **Список** — документы коллекции или прямые дети документа (`list.js`)
- **Вложения** — загрузка, скачивание, удаление файлов (`attachments.js`)
- **Управление** — delete, archive, duplicate, **move** (смена parent/коллекции с post-check)
- **Структура** — просмотр иерархии коллекций
- **Import/Export** — работа с markdown файлами

## 📦 Установка

Зависимостей нет, `bun install` не нужен.

```bash
git clone https://github.com/qwexs/outline-skill.git
cd outline-skill
cp config.example.json config.json
# отредактируйте config.json — см. раздел «Конфигурация»
```

## ⚙️ Конфигурация

Поддерживается **несколько Outline-инстансов** в одном skill.

### `config.json` (в `.gitignore`, не коммитится)

```json
{
  "defaultInstance": "work",
  "instances": {
    "work": { "baseUrl": "https://outline.example.com/api" },
    "personal": { "baseUrl": "https://other.example.com/api" }
  }
}
```

Legacy single-instance тоже работает: `{ "baseUrl": "https://.../api" }`.

Шаблон — `config.example.json`. Имена инстансов — произвольные ключи; env-суффикс = `UPPER_SNAKE` от имени.

### Токены (не в файлах)

Порядок для каждого инстанса:

1. `OUTLINE_API_TOKEN_<NAME>` — рекомендуется для multi-instance  
   (`work` → `OUTLINE_API_TOKEN_WORK`, `personal` → `OUTLINE_API_TOKEN_PERSONAL`)
2. `OUTLINE_API_TOKEN` — только для **default** инстанса (compat)
3. `instances.<name>.apiToken` / top-level `apiToken` — legacy disk fallback

```bash
export OUTLINE_API_TOKEN_WORK="ol_api_..."
export OUTLINE_API_TOKEN_PERSONAL="ol_api_..."
# optional alias for default:
export OUTLINE_API_TOKEN="$OUTLINE_API_TOKEN_WORK"
```

### Выбор инстанса

Доступен на **всех** скриптах (`--instance` / `-i`):

```bash
bun scripts/list-collections.js --instance personal
bun scripts/search.js --query "deploy" -i personal
bun scripts/tree.js --collection <id> --instance work --json
bun scripts/test-connection.js --all
```

Порядок: `--instance`/`-i` → env `OUTLINE_INSTANCE` → `config.defaultInstance`.

> ⚠️ **ЗАГЛУШКИ.** `your-outline.example.com` / `REPLACE_WITH_*` — не реальные домены. Перед публикацией URL в чат — снимай origin через `bun scripts/test-connection.js --instance <name>`, не из SKILL.md.

## 🔧 Quick Commands

### Поиск документов
```bash
bun scripts/search.js --query "deployment"
bun scripts/search.js --query "api" --collection <id> --date-filter month
bun scripts/search.js --query "bug" --limit 10 --json
```

### Чтение документа

`--id` принимает **UUID или URL-slug** (например, `b9fqMIBlh9` из ссылки `/doc/...-b9fqMIBlh9`). Outline API сам распознаёт формат, отдельный fallback не нужен.

```bash
# По UUID
bun scripts/read.js --id 21641e94-dbdc-4aa9-acef-84349f9b9fc1
# По URL-slug (напрямую, без предварительного search)
bun scripts/read.js --id b9fqMIBlh9
# JSON-вывод
bun scripts/read.js --id b9fqMIBlh9 --json
# Path: Collection / Parent / Doc (отключить: --no-breadcrumb)
```

#### Экономия контекста: выбор режима чтения

- Документ небольшой → обычный вывод в stdout.
- Большой документ, который потом будет читать file-reader агента → `--output-file <абсолютный-путь-в-workspace>`: markdown сохраняется в доступный агенту `.md` файл, без дублирования тела в stdout.
- Нужный диапазон строк уже известен → `--lines`: вернёт только его, с абсолютными номерами строк.

**Выборка по строкам** (1-based, включительно):
```bash
bun scripts/read.js --id <doc-id> --lines 10-20     # диапазон
bun scripts/read.js --id <doc-id> --lines 100-      # от строки 100 до конца
bun scripts/read.js --id <doc-id> --lines 10        # одна строка
bun scripts/read.js --id <doc-id> --from-line 10 --to-line 20   # то же отдельными флагами
bun scripts/read.js --id <doc-id> --line-numbers    # нумеровать весь вывод
```
Номера строк в выводе — всегда абсолютные (номера строк документа), по ним легко делать следующие `--lines`-запросы. Ошибочный диапазон (не числом, до начала, за EOF) → `exit 1` с сообщением, а не тихий вывод всего документа. В `--json`-режиме при выборке добавляется поле `selectedLines`, а `data.text` содержит только выбранный диапазон.

**Чтение в файл** («как с локальным .md»):
```bash
# Рекомендуется для агента: абсолютный путь внутри его workspace
bun scripts/read.js --id <doc-id> \
  --output-file /absolute/path/in/workspace/my-doc.md
# Выборка строк + файл
bun scripts/read.js --id <doc-id> --lines 100-150 \
  --output-file /absolute/path/in/workspace/section.md
```
Получаешь реальный `.md` файл: его можно читать построчно, `grep`-ать и передавать другим инструментам. Тело документа при этом в stdout не дублируется — только метаданные и путь к файлу.

> ⚠️ Для последующего чтения агентом передавай `--output-file` с **абсолютным путём внутри его workspace**; родительская директория должна уже существовать.

### Passing a markdown body

The shell expands backticks (`` ` ``) and `$(...)` **before** the script starts. Node receives an already-corrupted argument — `create.js` / `update.js` cannot undo that.

**Do not** pass markdown that contains backticks, `$(...)`, or multiple lines via `--text` / `--find` as a CLI argument.

For that content, use a file or stdin:

| | create | update |
|---|---|---|
| file | `--file <path>` | `--text-file <path>` |
| pipe / quoted heredoc | stdin | stdin |
| short single-line string with no `` ` `` or `$(...)` | `--text` | `--text` |

```bash
# create
bun scripts/create.js --title "Import" --file ./document.md --collection <id> --publish
cat document.md | bun scripts/create.js --title "Import" --collection <id> --publish

# update
bun scripts/update.js --id <id> --mode replace --text-file ./document.md
cat document.md | bun scripts/update.js --id <id> --mode replace

# quoted heredoc (quotes around EOF are required — otherwise the shell eats backticks)
cat << 'EOF' | bun scripts/update.js --id <id> --mode append
## Code
`inline` and fenced blocks stay intact
EOF
```

`--find` with backticks is the same trap: write the fragment to a file and pass `--find-file`.

### Создание документа

Pass the body through **exactly one** source (priority `--file` > `--text` > stdin):

```bash
# From a file (preferred)
bun scripts/create.js --title "Import" --file ./document.md --collection <id> --publish

# From stdin (cat / quoted heredoc / pipe)
cat document.md | bun scripts/create.js --title "Import" --collection <id> --publish
echo "# My Document\n\nContent here" | bun scripts/create.js --title "New Doc" --publish

# Inline — short string only, no backticks / $(...)
bun scripts/create.js --title "Quick Note" --text "# Note\n\nContent" --publish

# From a template (body comes from the template unless --text/--file/stdin is set)
bun scripts/create.js --title "From template" --template-id <uuid> --collection <id> --publish
```

**Строгие правила скрипта** (важно):

- `--title` обязателен (или достаточно `--template-id`, если title возьмёт template) — иначе `exit 1`.
- Любой неизвестный флаг (`--input`, `--path`, опечатка) → `exit 1` с явным сообщением. Скрипт **не тихой** для незнакомых опций.
- Если контент нигде не задан (`--file` / `--text` / stdin — всё пустое) → `exit 1` с подсказкой. Защита от «забыл передать тело» и silent empty-документов.
- `--file <path>` проверяет существование файла до запроса к API (быстрый fail с понятным сообщением).
- Приоритет при нескольких источниках: `--file > --text > stdin`. Пустой `--text=""` или пустой stdin **не считаются** источником, чтобы `--text` не съел `--file`.
- `--collection <uuid>` и `--parent <uuid>` опциональны. `--publish` публикует; без него — draft.

```bash
# Полная справка
bun scripts/create.js --help
```

### Обновление документа

Body source priority: `--text-file` > `--text` > stdin. `update.js` takes `--text-file`, not `--file`.

```bash
# Replace — overwrites the entire body; always pass --mode explicitly
bun scripts/update.js --id <id> --mode replace --text-file ./new-body.md
cat new-body.md | bun scripts/update.js --id <id> --mode replace

# Append / prepend
echo "\n\n## New Section\n\nMore content" | bun scripts/update.js --id <id> --mode append
bun scripts/update.js --id <id> --text "⚠️ Warning: ..." --mode prepend

# Patch (required for surgical edits) — same as official MCP.
# --find / --find-file = exact markdown substring; --text / --text-file = replacement.
# The script checks the fragment occurs exactly once and preserves
# rich formatting outside the matched region.
bun scripts/update.js --id <id> --mode patch \
  --find-file ./old-fragment.md \
  --text-file ./new-fragment.md

# Short fragment with no backticks may be inline
bun scripts/update.js --id <id> --mode patch \
  --find "api.old.com" \
  --text "api.new.com"

# Safe shorthand: --find / --find-file without --mode infers patch.
# Without --find, a text update requires an explicit --mode.
```

### Шаблоны (templates)
```bash
bun scripts/templates.js
bun scripts/templates.js --collection <id>
bun scripts/templates.js --id <template-uuid>
bun scripts/templates.js --json
```

### Список документов
```bash
# Все документы в коллекции
bun scripts/list.js --collection <id>

# Прямые дети документа (sub-issues / sub-pages)
bun scripts/list.js --parent <id>

# JSON-вывод
bun scripts/list.js --parent <id> --json
```

### Список коллекций
```bash
bun scripts/list-collections.js
bun scripts/list-collections.js --json
```

### Дерево документов
```bash
bun scripts/tree.js --collection <id>
bun scripts/tree.js --collection <id> --json
```

### Вложения (attachments)

Outline использует **two-phase upload**:
1. `attachments.create` с `name` / `contentType` / `size` / optional `documentId` (без base64) → `{ attachment, uploadUrl, form }`
2. multipart POST файла на `uploadUrl` (часто relative `/api/files.create` или signed S3 URL) с полями `form` + `file`

`attachments.js --action create` делает оба шага. В stdout печатает **ID**, **Path** (`/api/attachments.redirect?id=...`) и **MD** (`![name](/api/attachments.redirect?id=...)`) — вставляй MD в документ.

```bash
# Список вложений документа
bun scripts/attachments.js --action list --document-id <id>

# Глобальный пул вложений
bun scripts/attachments.js --action list

# Загрузить файл (content-type угадывается из расширения: jpg/png/webp/gif/pdf/md/...)
bun scripts/attachments.js --action create \
  --file ./diagram.png \
  --document-id <doc-id>

# Явные name + content-type
bun scripts/attachments.js --action create \
  --file ./handoff.md \
  --name handoff.md \
  --content-type text/markdown \
  --document-id <doc-id>

# Получить URL для скачивания
bun scripts/attachments.js --action redirect --attachment-id <id>

# Удалить вложение
bun scripts/attachments.js --action delete --attachment-id <id>
```

### Создание / обновление коллекции
```bash
bun scripts/create-collection.js --name "Design" --description "Дизайн и UI/UX"
bun scripts/create-collection.js --name "Private" --private --json

# Update existing collection
bun scripts/update-collection.js --id <uuid> --name "New name"
bun scripts/update-collection.js --id <uuid> --description "..." --color "#FF5C80"
bun scripts/update-collection.js --id <uuid> --private
bun scripts/update-collection.js --id <uuid> --public
```

### История документа (ревизии)
```bash
# Список всех ревизий документа
bun scripts/revisions.js --id <document-id>

# Показать содержимое конкретной ревизии (1 = самая новая)
bun scripts/revisions.js --id <document-id> --rev 1

# Показать ревизию по индексу (6 = шестая с конца)
bun scripts/revisions.js --id <document-id> --rev 6

# Показать ревизию по UUID
bun scripts/revisions.js --id <document-id> --rev <revision-uuid>

# JSON вывод
bun scripts/revisions.js --id <document-id> --json
```

### Удаление
```bash
bun scripts/delete.js --id <id>               # В корзину
bun scripts/delete.js --id <id> --permanent   # Навсегда
```

### Архивация
```bash
bun scripts/archive.js --id <id>              # Архивировать
bun scripts/archive.js --id <id> --restore    # Восстановить
```

### Дублирование
```bash
bun scripts/duplicate.js --id <id> --title "Copy of Doc"
bun scripts/duplicate.js --id <id> --recursive --publish  # С child документами
```

### Перемещение (смена parent и/или коллекции)
```bash
# Сменить только parent внутри коллекции (предпочтительный способ)
bun scripts/move.js --id <id> --parent <parent-id>
# Сменить parent + перенести в другую коллекцию
bun scripts/move.js --id <id> --collection <new-coll-id> --parent <new-parent-id>
# Вынести документ на верхний уровень коллекции
bun scripts/move.js --id <id> --parent null

# ⚠️ Outline API молча игнорирует неизвестные поля POST-тела (например,
# опечатку `parentDocument` вместо `parentDocumentId`) и возвращает ok:true
# без фактического изменения. Скрипт делает post-check через documents.info,
# а с --expect-parent строго валидирует результат и падает с exit code 2,
# если parentDocumentId на сервере не совпал с ожиданием.
bun scripts/move.js --id <id> --parent <parent-id> --expect-parent <parent-id>
```

> Имя параметра — `parentDocumentId` (НЕ `parentDocument`, НЕ `parentId`).
> Если нужно только сменить parent без смены коллекции — `documents.update` тоже принимает `parentDocumentId` (см. `references/api-reference.md`).

### Export/Import
```bash
# Export
bun scripts/export.js --id <id> --output-file /absolute/path/in/workspace/doc.md
bun scripts/export.js --id <id> --include-children > full-export.md

# Import
bun scripts/import.js --file doc.md --title "Imported" --publish
cat document.md | bun scripts/import.js --title "From Stdin" --collection <id>
```

## 💡 Типичные сценарии

### 1. Поиск и обновление документа

```bash
# Если известен URL-slug (хвост ссылки /doc/...-XXXXX) — читаем сразу,
# без search:
bun scripts/read.js --id b9fqMIBlh9

# Иначе ищем по тексту, забираем ID/slug из результатов и читаем:
bun scripts/search.js --query "deployment guide"
bun scripts/read.js --id <id-or-slug>

# Добавить секцию
echo "\n\n## Troubleshooting\n\n..." | bun scripts/update.js --id <id> --mode append

# Surgical replace: read first, then --mode patch --find / --find-file.
# Multiline replacement or code — via --text-file, not --text.
# Do not use --mode replace unless you are sending the full new document body.
```

### 2. Создание технической документации
```bash
# Создать главную страницу
echo "# API Documentation\n\nOverview..." | \
  bun scripts/create.js --title "API Docs" --collection <id> --publish

# Получить ID родителя из вывода

# Создать child документы
echo "# Authentication\n\n..." | \
  bun scripts/create.js --title "Authentication" --parent <parent-id> --publish

echo "# Endpoints\n\n..." | \
  bun scripts/create.js --title "Endpoints" --parent <parent-id> --publish
```

### 3. Backup коллекции
```bash
# Экспортировать все документы
for doc_id in $(bun scripts/tree.js --collection <id> --json | jq -r '.[].id'); do
  bun scripts/export.js --id "$doc_id" --output-file "backup/$doc_id.md"
done
```

### 4. Получить sub-issues / дочерние страницы
```bash
# `tree.js` показывает только первый уровень вложенности. Для глубокого
# обхода используй `list.js --parent=<id>` рекурсивно:
PARENT_ID="<root-doc-id>"
bun scripts/list.js --parent "$PARENT_ID" --json | jq -r '.[].id' | while read -r child; do
  echo "Child: $child"
  bun scripts/list.js --parent "$child" --json | jq -r '.[] | "  - \(.title)"'
done
```

### 5. Прикрепить handoff markdown к issue
```bash
# Загрузить файл
bun scripts/attachments.js --action create \
  --file ./docs/agents/handoff/2026-06-XX.md \
  --name "phase-handoff.md" \
  --content-type text/markdown

# Получить ID из вывода, затем:
# 1. Скопировать redirect URL из ответа create
# 2. Добавить ссылку в issue через update.js --mode append
```

### 6. Переместить документ к новому родителю
```bash
# Проверить текущего родителя
bun scripts/read.js --id <doc-id> --json | jq '.data.parentDocumentId'

# Сменить parent (с post-check, чтобы поймать silent no-op от Outline API)
bun scripts/move.js --id <doc-id> --parent <new-parent-id> --expect-parent <new-parent-id>

# Если exit code 2 — Outline проигнорировал поле; проверь имя (`parentDocumentId`)
# и не путаешь ли ты endpoint: для смены parent внутри коллекции годятся и
# documents.update (с parentDocumentId), и documents.move.
```

## 📚 Документация

- **[references/api-reference.md](references/api-reference.md)** — Детали Outline API
- **[references/examples.md](references/examples.md)** — Workflow примеры

## 🔍 Debugging

Все скрипты поддерживают `--json` для программного использования:
```bash
result=$(bun scripts/search.js --query "test" --json)
echo "$result" | jq '.data[0].document.title'
```

Проверить, что auth и baseUrl настроены правильно:
```bash
bun scripts/test-connection.js
```

> ⚠️ **Перед публикацией URL в чат / документ / issue** — снимать реальный домен через `test-connection.js`. Скрипт вернёт origin вида `https://outline.<your-domain>` и подтвердит подключение. **Никогда** не публиковать URL из SKILL.md / config.example.json / README.md / references/*.md — там placeholder `your-outline.example.com` или `REPLACE_WITH_YOUR_OUTLINE_DOMAIN`.

## 🛠️ Разработка

**Структура skill:**
```
skills/outline/
├── SKILL.md                 # Эта документация
├── README.md                # GitHub-ориентированный обзор
├── LICENSE                  # MIT
├── config.example.json      # Шаблон для config.json
├── config.json              # Локальная конфигурация (в .gitignore)
├── package.json             # Bun dependencies
├── scripts/
│   ├── search.js            # Поиск
│   ├── read.js              # Чтение
│   ├── create.js            # Создание документа
│   ├── create-collection.js # Создание коллекции
│   ├── update.js            # Обновление
│   ├── delete.js            # Удаление
│   ├── archive.js           # Архивация
│   ├── duplicate.js         # Дублирование
│   ├── move.js              # Перемещение (parent / коллекция) + post-check
│   ├── export.js            # Экспорт markdown
│   ├── import.js            # Импорт markdown
│   ├── revisions.js         # История документа (ревизии)
│   ├── tree.js              # Дерево коллекции (depth 1)
│   ├── list.js              # Документы коллекции или дети parent
│   ├── list-collections.js  # Список коллекций
│   ├── attachments.js       # Вложения: list / create / delete / redirect
│   ├── test-connection.js   # Проверка auth и baseUrl
│   └── lib/
│       └── outline-api.js   # Core API wrapper (читает OUTLINE_API_TOKEN)
└── references/
    ├── api-reference.md     # API детали
    └── examples.md          # Workflow примеры
```

**API wrapper:** `scripts/lib/outline-api.js` — единая точка для всех запросов к Outline API.

**Note про namespace:** в текущей версии Outline attachments живут под namespace `attachments.*` (не `documents.attachments.*`). `attachments.js` уже учитывает это.

**Note про depth в `tree.js`:** `collections.documents` отдаёт только первый уровень вложенности. Для sub-pages используйте `list.js --parent=<id>` (как в сценарии 4).
