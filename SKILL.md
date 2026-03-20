---
name: outline
description: Work with Outline Wiki (your-outline.example.com) - search, create, update documents and collections. Use when working with wiki documentation, knowledge base articles, or team documentation management.
---

# Outline Wiki Skill

Skill для работы с Outline Wiki (your-outline.example.com) — поиск, создание и управление документацией.

## 🎯 Что умеет

- **Поиск** — full-text search по всей wiki с контекстными сниппетами
- **Чтение** — получение документов по ID
- **Создание** — новые документы (markdown)
- **Обновление** — редактирование с режимами replace/append/prepend
- **Управление** — delete, archive, duplicate
- **Структура** — просмотр иерархии коллекций
- **Import/Export** — работа с markdown файлами

## 📦 Установка

```bash
cd /root/.openclaw/workspace/skills/outline
bun install  # На случай если понадобятся зависимости (пока нет)
```

## ⚙️ Конфигурация

`config.json` (не коммитится, в `.gitignore`):
```json
{
  "baseUrl": "https://your-outline-instance.example.com/api",
  "apiToken": "ol_api_YOUR_TOKEN_HERE"
}
```

## 🔧 Quick Commands

### Поиск документов
```bash
node scripts/search.js --query "deployment"
node scripts/search.js --query "api" --collection <id> --date-filter month
node scripts/search.js --query "bug" --limit 10 --json
```

### Чтение документа
```bash
node scripts/read.js --id <document-id>
node scripts/read.js --id <id> --json
```

### Создание документа
```bash
# Интерактивно
echo "# My Document\n\nContent here" | node scripts/create.js --title "New Doc" --publish

# Из файла
cat document.md | node scripts/create.js --title "Import" --collection <id> --publish

# С аргументом
node scripts/create.js --title "Quick Note" --text "# Note\n\nContent" --publish
```

### Обновление документа
```bash
# Replace mode (по умолчанию)
node scripts/update.js --id <id> --text "New content"

# Append mode (добавить в конец)
echo "\n\n## New Section\n\nMore content" | node scripts/update.js --id <id> --mode append

# Prepend mode (добавить в начало)
node scripts/update.js --id <id> --text "⚠️ Warning: ..." --mode prepend
```

### Создание коллекции
```bash
node scripts/create-collection.js --name "Design" --description "Дизайн и UI/UX"
node scripts/create-collection.js --name "Private" --private --json
```

### Список коллекций
```bash
node scripts/list-collections.js
node scripts/list-collections.js --json
```

### Дерево документов
```bash
node scripts/tree.js --collection <id>
node scripts/tree.js --collection <id> --json
```

### История документа (ревизии)
```bash
# Список всех ревизий документа
node scripts/revisions.js --id <document-id>

# Показать содержимое конкретной ревизии (1 = самая новая)
node scripts/revisions.js --id <document-id> --rev 1

# Показать ревизию по индексу (6 = шестая с конца)
node scripts/revisions.js --id <document-id> --rev 6

# Показать ревизию по UUID
node scripts/revisions.js --id <document-id> --rev <revision-uuid>

# JSON вывод
node scripts/revisions.js --id <document-id> --json
```

### Удаление
```bash
node scripts/delete.js --id <id>               # В корзину
node scripts/delete.js --id <id> --permanent   # Навсегда
```

### Архивация
```bash
node scripts/archive.js --id <id>              # Архивировать
node scripts/archive.js --id <id> --restore    # Восстановить
```

### Дублирование
```bash
node scripts/duplicate.js --id <id> --title "Copy of Doc"
node scripts/duplicate.js --id <id> --recursive --publish  # С child документами
```

### Export/Import
```bash
# Export
node scripts/export.js --id <id> --output doc.md
node scripts/export.js --id <id> --include-children > full-export.md

# Import
node scripts/import.js --file doc.md --title "Imported" --publish
cat doc.md | node scripts/import.js --title "From Stdin" --collection <id>
```

## 💡 Типичные сценарии

### 1. Поиск и обновление документа
```bash
# Найти документ
node scripts/search.js --query "deployment guide"
# Получить ID из результатов

# Прочитать текущий контент
node scripts/read.js --id <id>

# Добавить секцию
echo "\n\n## Troubleshooting\n\n..." | node scripts/update.js --id <id> --mode append
```

### 2. Создание технической документации
```bash
# Создать главную страницу
echo "# API Documentation\n\nOverview..." | \
  node scripts/create.js --title "API Docs" --collection <id> --publish

# Получить ID родителя из вывода

# Создать child документы
echo "# Authentication\n\n..." | \
  node scripts/create.js --title "Authentication" --parent <parent-id> --publish

echo "# Endpoints\n\n..." | \
  node scripts/create.js --title "Endpoints" --parent <parent-id> --publish
```

### 3. Backup коллекции
```bash
# Экспортировать все документы
for doc_id in $(node scripts/tree.js --collection <id> --json | jq -r '.[].id'); do
  node scripts/export.js --id "$doc_id" --output "backup/$doc_id.md"
done
```

## 📚 Документация

- **[references/api-reference.md](references/api-reference.md)** — Детали Outline API
- **[references/examples.md](references/examples.md)** — Примеры использования

## 🔍 Debugging

Все скрипты поддерживают `--json` для программного использования:
```bash
result=$(node scripts/search.js --query "test" --json)
echo "$result" | jq '.data[0].document.title'
```

## 🛠️ Разработка

**Структура skill:**
```
skills/outline/
├── SKILL.md              # Эта документация
├── config.json           # API конфигурация
├── package.json          # Bun dependencies
├── scripts/
│   ├── search.js         # Поиск
│   ├── read.js           # Чтение
│   ├── create.js         # Создание
│   ├── update.js         # Обновление
│   ├── delete.js         # Удаление
│   ├── archive.js        # Архивация
│   ├── duplicate.js      # Дублирование
│   ├── export.js         # Экспорт markdown
│   ├── import.js         # Импорт markdown
│   ├── revisions.js      # История документа (ревизии)
│   ├── tree.js           # Дерево коллекции
│   ├── create-collection.js # Создание коллекции
│   ├── list-collections.js  # Список коллекций
│   └── lib/
│       └── outline-api.js   # Core API wrapper
└── references/
    ├── api-reference.md  # API детали
    └── examples.md       # Workflow примеры
```

**API wrapper:** `scripts/lib/outline-api.js` — единая точка для всех запросов к Outline API.
