---
name: outline
description: Work with Outline Wiki (your-outline.example.com) - search, create, update documents and collections. Use when working with wiki documentation, knowledge base articles, or team documentation management.
---

# Outline Wiki Skill

Skill для работы с Outline Wiki (your-outline.example.com) — поиск, создание и управление документацией.

## 🎯 Что умеет

- **Поиск** — full-text search по всей wiki с контекстными сниппетами
- **Чтение** — получение документов по ID
- **Создание** — новых документов и коллекций
- **Обновление** — редактирование с режимами replace/append/prepend
- **Управление** — delete, archive, duplicate
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
  "baseUrl": "https://your-outline.example.com/api"
}
```

Шаблон для `config.json` лежит в `config.example.json` — копируйте его.

Если токен не задан ни в env, ни в `config.json`, skill бросит понятную ошибку при первом запросе.

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
```bash
# Интерактивно
echo "# My Document\n\nContent here" | bun scripts/create.js --title "New Doc" --publish

# Из файла
cat document.md | bun scripts/create.js --title "Import" --collection <id> --publish

# С аргументом
bun scripts/create.js --title "Quick Note" --text "# Note\n\nContent" --publish
```

### Обновление документа
```bash
# Replace mode (по умолчанию)
bun scripts/update.js --id <id> --text "New content"

# Append mode (добавить в конец)
echo "\n\n## New Section\n\nMore content" | bun scripts/update.js --id <id> --mode append

# Prepend mode (добавить в начало)
bun scripts/update.js --id <id> --text "⚠️ Warning: ..." --mode prepend
```

### Создание коллекции
```bash
bun scripts/create-collection.js --name "Design" --description "Дизайн и UI/UX"
bun scripts/create-collection.js --name "Private" --private --json
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

## 🛠️ Разработка

**Структура skill:**
```
skills/outline/
├── SKILL.md              # Эта документация
├── config.example.json   # Шаблон для config.json
├── config.json           # Локальная конфигурация (в .gitignore)
├── package.json          # Bun dependencies
├── scripts/
│   ├── search.js         # Поиск
│   ├── read.js           # Чтение
│   ├── create.js         # Создание документа
│   ├── create-collection.js # Создание коллекции
│   ├── update.js         # Обновление
│   ├── delete.js         # Удаление
│   ├── archive.js        # Архивация
│   ├── duplicate.js      # Дублирование
│   ├── export.js         # Экспорт markdown
│   ├── import.js         # Импорт markdown
│   ├── revisions.js      # История документа (ревизии)
│   ├── tree.js           # Дерево коллекции
│   ├── list-collections.js  # Список коллекций
│   ├── test-connection.js   # Проверка auth и baseUrl
│   └── lib/
│       └── outline-api.js   # Core API wrapper (читает OUTLINE_API_TOKEN)
└── references/
    ├── api-reference.md  # API детали
    └── examples.md       # Workflow примеры
```

**API wrapper:** `scripts/lib/outline-api.js` — единая точка для всех запросов к Outline API.
