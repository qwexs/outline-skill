# Outline Workflow Examples

Practical Outline Wiki workflows using the skill scripts.

## Scenario 1: Create project documentation

**Goal:** Scaffold documentation for a new project.

```bash
# 1. Find the target collection
node scripts/list-collections.js

# Suppose the "Engineering" collection has ID abc-123

# 2. Create the project home page
echo "# Project Radik

Radik is a new project for...

## Overview
...

## Architecture
..." | node scripts/create.js \
  --title "Project Radik" \
  --collection abc-123 \
  --publish

# Output:
# ✅ Document created
# ID: project-123
# URL: https://your-outline.example.com/doc/project-123

# 3. Create child documents
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

# 4. Check the structure
node scripts/tree.js --collection abc-123
```

**Result:**
```
📁 Project Radik
  📄 Backend
  📄 Frontend
```

---

## Scenario 2: Update a document (append mode)

**Goal:** Add a troubleshooting section to an existing document.

```bash
# 1. Find the document
node scripts/search.js --query "deployment guide"

# ID from the results: deploy-456

# 2. Read the current content (optional)
node scripts/read.js --id deploy-456

# 3. Append a new section
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

# Output:
# ✅ Document updated
# Mode: append
```

---

## Scenario 3: Search and bulk patch

**Goal:** Find every document that mentions an old API endpoint and update it surgically, without overwriting the rest of the document.

```bash
# 1. Search
results=$(node scripts/search.js --query "api.old.com" --json)

# 2. Extract IDs
doc_ids=$(echo "$results" | jq -r '.data[].document.id')

# 3. For each document: read, check, update
for id in $doc_ids; do
  echo "Processing $id..."
  
  # Read the document
  content=$(node scripts/read.js --id "$id" --json | jq -r '.data.text')
  
  # Check whether the old URL is present
  if echo "$content" | grep -q "api.old.com"; then
    # Surgical replace. update.js checks the old URL occurs exactly once.
    # If the document has several matches, pick a longer unique --find.
    node scripts/update.js --id "$id" --mode patch \
      --find "api.old.com" \
      --text "api.new.com"
    echo "✅ Patched $id"
  fi
done
```

---

## Scenario 4: Export for backup

**Goal:** Export every document in a collection for backup.

```bash
# 1. Get the collection tree
collection_id="abc-123"
tree_json=$(node scripts/tree.js --collection "$collection_id" --json)

# 2. Recursively extract all document IDs
extract_ids() {
  echo "$1" | jq -r '
    .. | 
    objects | 
    select(has("id")) | 
    .id
  '
}

doc_ids=$(extract_ids "$tree_json")

# 3. Create a backup directory
backup_dir="backup/$(date +%Y-%m-%d)"
mkdir -p "$backup_dir"

# 4. Export each document
for id in $doc_ids; do
  echo "Exporting $id..."
  node scripts/export.js \
    --id "$id" \
    --output-file "$backup_dir/$id.md"
done

echo "✅ Backup complete: $backup_dir"
```

---

## Scenario 5: Import a batch of documents

**Goal:** Import several markdown files as documents.

```bash
# File layout:
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

## Scenario 6: Duplicate and fill in

**Goal:** Copy a template document and fill it with data.

```bash
# 1. Duplicate the template
template_id="template-789"
result=$(node scripts/duplicate.js \
  --id "$template_id" \
  --title "Q1 2026 Report" \
  --json)

new_id=$(echo "$result" | jq -r '.data.id')

# 2. Update the copy (replace placeholders)
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

## Scenario 7: Navigate a hierarchy

**Goal:** Find a document in a collection tree.

```bash
# 1. Show the tree
node scripts/tree.js --collection abc-123

# Output:
# 📁 Getting Started
#   📄 Installation
#   📄 Quick Start
# 📁 API
#   📄 Authentication
#   📄 Endpoints

# 2. Search the tree by title
tree_json=$(node scripts/tree.js --collection abc-123 --json)

# Find the "Authentication" document
auth_id=$(echo "$tree_json" | jq -r '
  .. | 
  objects | 
  select(.title == "Authentication") | 
  .id
')

echo "Authentication doc ID: $auth_id"

# 3. Read the document
node scripts/read.js --id "$auth_id"
```

---

## Scenario 8: Organize a knowledge base

**Goal:** Create a knowledge base with FAQ sections.

```bash
collection_id="kb-001"

# 1. Create the main FAQ page
faq_id=$(echo "# FAQ

Frequently asked questions." | \
  node scripts/create.js \
    --title "FAQ" \
    --collection "$collection_id" \
    --publish \
    --json | jq -r '.data.id')

# 2. Create FAQ categories
categories=("Account" "Billing" "Technical" "Product")

for category in "${categories[@]}"; do
  echo "# $category FAQ

Questions about $category..." | \
    node scripts/create.js \
      --title "$category" \
      --parent "$faq_id" \
      --publish
done

# 3. Check the structure
node scripts/tree.js --collection "$collection_id"
```

---

## Tips & Best Practices

### 1. Use append mode for logs / changelog
```bash
echo "\n\n### 2026-02-10\n- Fixed bug X\n- Added feature Y" | \
  node scripts/update.js --id changelog-id --mode append
```

### 2. Check before deleting
```bash
# Read first
node scripts/read.js --id doc-to-delete

# Then archive (safer than delete)
node scripts/archive.js --id doc-to-delete

# Permanent delete only if you are sure
node scripts/delete.js --id doc-to-delete --permanent
```

### 3. JSON mode for automation
```bash
results=$(node scripts/search.js --query "api" --json)
count=$(echo "$results" | jq '.data | length')
echo "Found $count documents"
```

### 4. Stdin / file for a markdown body
```bash
# create: --file or stdin
cat large-document.md | node scripts/create.js --title "Large Doc" --publish
./generate-report.sh | node scripts/create.js --title "Generated Report" --publish

# update: --text-file or stdin (not --text if the body contains backticks)
node scripts/update.js --id <id> --mode replace --text-file ./new-body.md
```

### 5. Batch operations with error handling
```bash
for id in $doc_ids; do
  if node scripts/update.js --id "$id" --mode patch --find "old text" --text "new text" 2>/dev/null; then
    echo "✅ Updated $id"
  else
    echo "❌ Failed $id" >> errors.log
  fi
done
```
