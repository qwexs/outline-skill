---
name: outline
description: Work with Outline Wiki (your-outline.example.com) - search, read, create, update, list documents and collections, manage file attachments. Use when working with wiki documentation, knowledge base articles, or team documentation management.
---

# Outline Wiki Skill

Skill для работы с Outline Wiki (your-outline.example.com) — поиск, создание, чтение, обновление и управление документацией и вложениями.

## 🎯 Что умеет

- **Поиск** — full-text search по всей wiki с контекстными сниппетами
- **Чтение** — получение документов по ID
- **Создание** — новых документов и коллекций (`--file`, `--text` или stdin; строгая валидация флагов и пустого тела)
- **Обновление** — редактирование с режимами replace/append/prepend
- **Список** — документы коллекции или прямые дети документа (`list.js`)
- **Вложения** — загрузка, скачивание, удаление файлов (`attachments.js`) — двухфазная загрузка (metadata + file upload)
- **Прикрепление файлов** — `--attach` при создании (`create.js`) и редактировании (`update.js`) документов
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

**Токен не хранится в файлах.** Резолвер читает в таком порядке:

1. `OUTLINE_API_TOKEN` env var — рекомендуется. Задайте один раз в shell-rc:
   ```bash
   # ~/.zshenv (или ~/.bashrc)
   export OUTLINE_API_TOKEN="ol_api_..."
   ```
2. `config.apiToken` — legacy fallback, если env недоступен.

`config.json` (уже в `.gitignore`, **не коммитится**):
```json
{
  "baseUrl": "https://REPLACE_WITH_YOUR_OUTLINE_DOMAIN/api"
}
```

Шаблон для `config.json` лежит в `config.example.json` — копируйте его.

Если токен не задан ни в env, ни в `config.json`, skill бросит понятную ошибку при первом запросе.

### Corporate proxy / `NO_PROXY`

Если заданы `HTTP_PROXY` / `HTTPS_PROXY`, запросы к **внутреннему** Outline часто зависают. Bun/Node `fetch` уважают эти переменные.

**Рекомендуемый `NO_PROXY`** (подставь свой Outline host):

```bash
export NO_PROXY="localhost,127.0.0.1,::1,outline.example.com,.example.com"
export no_proxy="$NO_PROXY"
```

```powershell
$env:NO_PROXY = "localhost,127.0.0.1,::1,outline.example.com,.example.com"
$env:no_proxy = $env:NO_PROXY
```

`scripts/lib/outline-api.js` дополнительно дописывает hostname из `config.baseUrl` (+ parent domain) в `NO_PROXY`/`no_proxy` **для процесса skill**. Явный `NO_PROXY` в shell/service env всё равно предпочтителен (другие клиенты, например PowerShell `Invoke-WebRequest`, skill не патчит).

> ⚠️ **ВАЖНО — ЗАГЛУШКА.** `your-outline.example.com` и `REPLACE_WITH_YOUR_OUTLINE_DOMAIN` — это **плейсхолдеры**, не реальный домен. Реальный URL — в `config.json` после настройки (например, `https://outline.<your-domain>/api`). `test-connection.js` теперь падает с ошибкой, если видит placeholder, — это guard против типичной ошибки «скопировал шаблон из SKILL.md, забыл подставить свой домен». Перед публикацией любого URL (`/doc/...`, `/collection/...`) в чат или документ — **снимать реальный домен через `bun scripts/test-connection.js`**, а не из этого файла.

## 🔧 Quick Commands

### Поиск документов
```bash
bun scripts/search.js --query "deployment"
bun scripts/search.js --query "api" --collection <id> --date-filter month
bun scripts/search.js --query "bug" --limit 10 --json
```

### Чтение документа
```bash
bun scripts/read.js --id <document-id>
bun scripts/read.js --id <id> --json
```

### Создание документа

**Контент можно передать ровно одним из способов** (приоритет `--file` > `--text` > stdin):

```bash
# Из файла (рекомендуемый способ для больших markdown)
bun scripts/create.js --title "Import" --file ./document.md --collection <id> --publish

# Из stdin (cat / heredoc / pipe)
cat document.md | bun scripts/create.js --title "Import" --collection <id> --publish
echo "# My Document\n\nContent here" | bun scripts/create.js --title "New Doc" --publish

# Инлайн-аргументом
bun scripts/create.js --title "Quick Note" --text "# Note\n\nContent" --publish

# С прикреплением файлов
bun scripts/create.js --title "Report" --text "# Report\n\nSee attached PDF" \
  --collection <id> --publish \
  --attach ./report.pdf \
  --attach ./data.xlsx

# С именем для вложения
bun scripts/create.js --title "Doc" --text "Content" \
  --attach ./file.pdf --attach-name "Отчёт за июль.pdf"
```

**Строгие правила скрипта** (важно):

- `--title` обязателен — без него `exit 1`.
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
```bash
# Replace mode (по умолчанию)
bun scripts/update.js --id <id> --text "New content"

# Append mode (добавить в конец)
echo "\n\n## New Section\n\nMore content" | bun scripts/update.js --id <id> --mode append

# Prepend mode (добавить в начало)
bun scripts/update.js --id <id> --text "⚠️ Warning: ..." --mode prepend

# Прикрепить файлы к существующему документу
bun scripts/update.js --id <id> --mode append \
  --text "## Updated section\n\nNew content" \
  --attach ./report.pdf \
  --attach ./data.xlsx

# Только прикрепить файлы (без изменения текста)
bun scripts/update.js --id <id> --attach ./report.pdf --attach-name "Отчёт.pdf"
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
```bash
# Список вложений документа
bun scripts/attachments.js --action list --document-id <id>

# Глобальный пул вложений
bun scripts/attachments.js --action list

# Загрузить файл (двухфазная загрузка: metadata + file upload)
bun scripts/attachments.js --action create \
  --file ./handoff.md \
  --name handoff.md \
  --content-type text/markdown \
  --document-id <doc-id>

# Загрузить PDF в документ
bun scripts/attachments.js --action create \
  --file ./report.pdf \
  --content-type application/pdf \
  --document-id <doc-id>

# Получить URL для скачивания
bun scripts/attachments.js --action redirect --attachment-id <id>

# Удалить вложение
bun scripts/attachments.js --action delete --attachment-id <id>
```

> ⚠️ **Важно:** `attachments.create` использует двухфазную загрузку.
> Шаг 1: `attachments.create` — создаёт метаданные, возвращает `uploadUrl` + `form`.
> Шаг 2: `files.create` — POST multipart/form-data с файлом.
> Скрипт `attachments.js` автоматически выполняет оба шага.
> Функция `uploadAttachment()` в `lib/outline-api.js` — для программного использования.

### Создание коллекции
```bash
bun scripts/create-collection.js --name "Design" --description "Дизайн и UI/UX"
bun scripts/create-collection.js --name "Private" --private --json
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
bun scripts/export.js --id <id> --output doc.md
bun scripts/export.js --id <id> --include-children > full-export.md

# Import
bun scripts/import.js --file doc.md --title "Imported" --publish
cat document.md | bun scripts/import.js --title "From Stdin" --collection <id>
```

## 💡 Типичные сценарии

### 1. Поиск и обновление документа
```bash
# Найти документ
bun scripts/search.js --query "deployment guide"
# Получить ID из результатов

# Прочитать текущий контент
bun scripts/read.js --id <id>

# Добавить секцию
echo "\n\n## Troubleshooting\n\n..." | bun scripts/update.js --id <id> --mode append
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
  bun scripts/export.js --id "$doc_id" --output "backup/$doc_id.md"
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
