# Outline Workflow Examples

Практические примеры работы с Outline Wiki через skill scripts.

## Сценарий 1: Создание документации проекта

**Задача:** Создать структуру документации для нового проекта.

```bash
# 1. Найти нужную коллекцию
node scripts/list-collections.js

# Допустим, коллекция "Engineering" имеет ID abc-123

# 2. Создать главную страницу проекта
echo "# Project Radik

Радик-портал — новый проект для...

## Overview
...

## Architecture
..." | node scripts/create.js \
  --title "Project Radik" \
  --collection abc-123 \
  --publish

# Вывод:
# ✅ Document created
# ID: project-123
# URL: https://your-outline.example.com/doc/project-123

# 3. Создать child документы
echo "# Backend Architecture

## Tech Stack
- Node.js
- PostgreSQL
..." | node scripts/create.js \
  --title "Backend" \
  --parent project-123 \
  --publish

echo "# Frontend Architecture

## Tech Stack
- React
- TypeScript
..." | node scripts/create.js \
  --title "Frontend" \
  --parent project-123 \
  --publish

# 4. Проверить структуру
node scripts/tree.js --collection abc-123
```

**Результат:**
```
📁 Project Radik
  📄 Backend
  📄 Frontend
```

---

## Сценарий 2: Обновление документа (append mode)

**Задача:** Добавить troubleshooting секцию в существующий документ.

```bash
# 1. Найти документ
node scripts/search.js --query "deployment guide"

# ID из результатов: deploy-456

# 2. Прочитать текущий контент (опционально)
node scripts/read.js --id deploy-456

# 3. Добавить новую секцию в конец
cat << 'EOF' | node scripts/update.js --id deploy-456 --mode append

## Troubleshooting

### Port Already in Use
If you see "EADDRINUSE" error:
```bash
sudo lsof -i :3000
kill -9 <PID>
```

### Database Connection Failed
Check `.env` file:
- DB_HOST should be localhost
- DB_PASSWORD must match PostgreSQL config

EOF

# Вывод:
# ✅ Document updated
# Mode: append
```

---

## Сценарий 3: Поиск и bulk update

**Задача:** Найти все документы с упоминанием старого API endpoint и обновить их.

```bash
# 1. Поиск документов
results=$(node scripts/search.js --query "api.old.com" --json)

# 2. Извлечь IDs
doc_ids=$(echo "$results" | jq -r '.data[].document.id')

# 3. Для каждого документа прочитать, проверить, обновить
for id in $doc_ids; do
  echo "Processing $id..."
  
  # Прочитать документ
  content=$(node scripts/read.js --id "$id" --json | jq -r '.data.text')
  
  # Проверить есть ли старый URL
  if echo "$content" | grep -q "api.old.com"; then
    # Заменить
    new_content=$(echo "$content" | sed 's|api.old.com|api.new.com|g')
    
    # Обновить
    echo "$new_content" | node scripts/update.js --id "$id" --mode replace
    echo "✅ Updated $id"
  fi
done
```

---

## Сценарий 4: Export для backup

**Задача:** Экспортировать все документы коллекции для backup.

```bash
# 1. Получить дерево коллекции
collection_id="abc-123"
tree_json=$(node scripts/tree.js --collection "$collection_id" --json)

# 2. Рекурсивно извлечь все document IDs
extract_ids() {
  echo "$1" | jq -r '
    .. | 
    objects | 
    select(has("id")) | 
    .id
  '
}

doc_ids=$(extract_ids "$tree_json")

# 3. Создать backup директорию
backup_dir="backup/$(date +%Y-%m-%d)"
mkdir -p "$backup_dir"

# 4. Экспортировать каждый документ
for id in $doc_ids; do
  echo "Exporting $id..."
  node scripts/export.js \
    --id "$id" \
    --output "$backup_dir/$id.md"
done

echo "✅ Backup complete: $backup_dir"
```

---

## Сценарий 5: Import batch documents

**Задача:** Импортировать несколько markdown файлов как документы.

```bash
# Структура файлов:
# docs/
#   intro.md
#   setup.md
#   troubleshooting.md

collection_id="abc-123"

for file in docs/*.md; do
  filename=$(basename "$file" .md)
  title=$(echo "$filename" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
  
  echo "Importing $file as '$title'..."
  
  node scripts/import.js \
    --file "$file" \
    --title "$title" \
    --collection "$collection_id" \
    --publish
done
```

---

## Сценарий 6: Duplicate и модифицировать

**Задача:** Создать копию документа-шаблона и заполнить данными.

```bash
# 1. Дублировать шаблон
template_id="template-789"
result=$(node scripts/duplicate.js \
  --id "$template_id" \
  --title "Q1 2026 Report" \
  --json)

new_id=$(echo "$result" | jq -r '.data.id')

# 2. Обновить копию (заменить placeholder'ы)
cat << 'EOF' | node scripts/update.js --id "$new_id" --mode replace
# Q1 2026 Report

## Summary
Revenue: $1.2M
Growth: +25% QoQ

## Key Metrics
- ARR: $5.4M
- Churn: 2.1%
- NPS: 68

## Highlights
- Launched feature X
- Signed 12 new enterprise customers
EOF
```

---

## Сценарий 7: Навигация по иерархии

**Задача:** Найти документ в дереве коллекции.

```bash
# 1. Показать дерево
node scripts/tree.js --collection abc-123

# Output:
# 📁 Getting Started
#   📄 Installation
#   📄 Quick Start
# 📁 API
#   📄 Authentication
#   📄 Endpoints

# 2. Искать по названию в дереве
tree_json=$(node scripts/tree.js --collection abc-123 --json)

# Найти "Authentication" документ
auth_id=$(echo "$tree_json" | jq -r '
  .. | 
  objects | 
  select(.title == "Authentication") | 
  .id
')

echo "Authentication doc ID: $auth_id"

# 3. Прочитать документ
node scripts/read.js --id "$auth_id"
```

---

## Сценарий 8: Организация знаний

**Задача:** Создать knowledge base с FAQ секциями.

```bash
collection_id="kb-001"

# 1. Создать главную FAQ страницу
faq_id=$(echo "# FAQ

Frequently asked questions." | \
  node scripts/create.js \
    --title "FAQ" \
    --collection "$collection_id" \
    --publish \
    --json | jq -r '.data.id')

# 2. Создать категории FAQ
categories=("Account" "Billing" "Technical" "Product")

for category in "${categories[@]}"; do
  echo "# $category FAQ

Questions about $category..." | \
    node scripts/create.js \
      --title "$category" \
      --parent "$faq_id" \
      --publish
done

# 3. Проверить структуру
node scripts/tree.js --collection "$collection_id"
```

---

## Tips & Best Practices

### 1. Используй append mode для логов/changelog
```bash
echo "\n\n### 2026-02-10\n- Fixed bug X\n- Added feature Y" | \
  node scripts/update.js --id changelog-id --mode append
```

### 2. Проверяй перед удалением
```bash
# Сначала читай
node scripts/read.js --id doc-to-delete

# Затем архивируй (безопаснее чем delete)
node scripts/archive.js --id doc-to-delete

# Permanent delete только если уверен
node scripts/delete.js --id doc-to-delete --permanent
```

### 3. JSON mode для автоматизации
```bash
results=$(node scripts/search.js --query "api" --json)
count=$(echo "$results" | jq '.data | length')
echo "Found $count documents"
```

### 4. Stdin для больших документов
```bash
cat large-document.md | node scripts/create.js --title "Large Doc" --publish
./generate-report.sh | node scripts/create.js --title "Generated Report" --publish
```

### 5. Batch операции с error handling
```bash
for id in $doc_ids; do
  if node scripts/update.js --id "$id" --text "..." 2>/dev/null; then
    echo "✅ Updated $id"
  else
    echo "❌ Failed $id" >> errors.log
  fi
done
```
