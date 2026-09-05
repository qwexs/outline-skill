---
name: outline
description: Work with Outline Wiki (your-outline.example.com) - search, read, create, update, list documents and collections, manage file attachments. Use when working with wiki documentation, knowledge base articles, or team documentation management.
---

# Outline Wiki Skill

Skill for Outline Wiki (your-outline.example.com) — search, create, read, update, and manage documentation and attachments.

## 🎯 What it does

- **Search** — full-text search across the wiki with context snippets and breadcrumbs
- **Read** — fetch documents by ID + path (`Collection / Parent / Doc`)
- **Create** — new documents and collections (`--file`, stdin, `--text`, or `--template-id`)
- **Update** — replace/append/prepend/**patch** (`--text-file` / stdin / `--text`; `editMode` + `findText`, same as official MCP)
- **Templates** — `templates.js` list/info + create from a template
- **Collections** — create + **update** (`update-collection.js`: name/description/color/icon/private/public)
- **List** — documents in a collection, or direct children of a document (`list.js`)
- **Attachments** — upload, download, delete files (`attachments.js`)
- **Manage** — delete, archive, duplicate, **move** (change parent/collection with a post-check)
- **Structure** — browse collection hierarchy
- **Import/Export** — work with markdown files

## 📦 Install

No dependencies. `bun install` is not required.

```bash
git clone https://github.com/qwexs/outline-skill.git
cd outline-skill
cp config.example.json config.json
# edit config.json — see Configuration
```

## ⚙️ Configuration

Multiple Outline instances are supported in one skill.

### `config.json` (gitignored, not committed)

```json
{
  "defaultInstance": "work",
  "instances": {
    "work": { "baseUrl": "https://outline.example.com/api" },
    "personal": { "baseUrl": "https://other.example.com/api" }
  }
}
```

Legacy single-instance still works: `{ "baseUrl": "https://.../api" }`.

Template: `config.example.json`. Instance names are arbitrary keys; the env suffix is `UPPER_SNAKE` of the name.

### Tokens (not in files)

Resolution order per instance:

1. `OUTLINE_API_TOKEN_<NAME>` — recommended for multi-instance  
   (`work` → `OUTLINE_API_TOKEN_WORK`, `personal` → `OUTLINE_API_TOKEN_PERSONAL`)
2. `OUTLINE_API_TOKEN` — **default** instance only (compat)
3. `instances.<name>.apiToken` / top-level `apiToken` — legacy disk fallback

```bash
export OUTLINE_API_TOKEN_WORK="ol_api_..."
export OUTLINE_API_TOKEN_PERSONAL="ol_api_..."
# optional alias for default:
export OUTLINE_API_TOKEN="$OUTLINE_API_TOKEN_WORK"
```

### Picking an instance

Available on **every** script (`--instance` / `-i`):

```bash
bun scripts/list-collections.js --instance personal
bun scripts/search.js --query "deploy" -i personal
bun scripts/tree.js --collection <id> --instance work --json
bun scripts/test-connection.js --all
```

Order: `--instance`/`-i` → env `OUTLINE_INSTANCE` → `config.defaultInstance`.

> ⚠️ **PLACEHOLDERS.** `your-outline.example.com` / `REPLACE_WITH_*` are not real hosts. Before publishing a URL in chat, resolve the origin with `bun scripts/test-connection.js --instance <name>` — not from SKILL.md.

## 🔧 Quick Commands

### Search documents
```bash
bun scripts/search.js --query "deployment"
bun scripts/search.js --query "api" --collection <id> --date-filter month
bun scripts/search.js --query "bug" --limit 10 --json
```

### Read a document

`--id` accepts a **UUID or URL slug** (e.g. `b9fqMIBlh9` from `/doc/...-b9fqMIBlh9`). The Outline API recognizes both; no extra fallback is needed.

```bash
# By UUID
bun scripts/read.js --id 21641e94-dbdc-4aa9-acef-84349f9b9fc1
# By URL slug (directly, no prior search)
bun scripts/read.js --id b9fqMIBlh9
# JSON output
bun scripts/read.js --id b9fqMIBlh9 --json
# Path: Collection / Parent / Doc (disable: --no-breadcrumb)
```

#### Saving context: which read mode to use

- Small document → print to stdout.
- Large document that an agent will then read with a file reader → `--output-file <absolute-path-in-workspace>`: markdown is written to an agent-accessible `.md` file and the body is not duplicated on stdout.
- Needed line range is already known → `--lines`: returns only that range, with absolute line numbers.

**Line selection** (1-based, inclusive):
```bash
bun scripts/read.js --id <doc-id> --lines 10-20     # range
bun scripts/read.js --id <doc-id> --lines 100-      # from line 100 to EOF
bun scripts/read.js --id <doc-id> --lines 10        # single line
bun scripts/read.js --id <doc-id> --from-line 10 --to-line 20   # same, as separate flags
bun scripts/read.js --id <doc-id> --line-numbers    # number the full output
```
Line numbers in the output are always absolute (document line numbers), so follow-up `--lines` requests are easy. A bad range (not a number, before the start, past EOF) → `exit 1` with a message, not a silent dump of the whole document. In `--json` mode a selection adds `selectedLines`, and `data.text` contains only the selected range.

**Read to a file** (treat it like a local `.md`):
```bash
# Preferred for agents: absolute path inside the workspace
bun scripts/read.js --id <doc-id> \
  --output-file /absolute/path/in/workspace/my-doc.md
# Line selection + file
bun scripts/read.js --id <doc-id> --lines 100-150 \
  --output-file /absolute/path/in/workspace/section.md
```
You get a real `.md` file: read it line by line, `grep` it, pass it to other tools. The document body is not also printed on stdout — only metadata and the file path.

> ⚠️ For a later agent read, pass `--output-file` with an **absolute path inside the workspace**; the parent directory must already exist.

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

**Temp sources:** write the body under `tmp/` (also `temp/` or `.tmp/`, including `/tmp`). After a successful upload, `create.js` / `update.js` / `import.js` / `attachments.js` delete `--file` / `--text-file` / `--find-file` / `--attach` paths that live in one of those directories. Other paths are never deleted. `--keep` skips deletion. Failed commands leave the file in place for a retry.

```bash
bun scripts/create.js --title "Import" --file ./tmp/document.md --collection <id> --publish
```

### Create a document

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

**Script rules** (important):

- `--title` is required (or `--template-id` is enough if the template supplies the title) — otherwise `exit 1`.
- Any unknown flag (`--input`, `--path`, a typo) → `exit 1` with an explicit message. The script does **not** silently ignore unknown options.
- If no body is provided (`--file` / `--text` / stdin all empty) → `exit 1` with a hint. Guards against forgotten bodies and silent empty documents.
- `--file <path>` checks that the file exists before calling the API (fast fail with a clear message).
- Source priority: `--file > --text > stdin`. Empty `--text=""` or empty stdin **do not count** as a source, so `--text` cannot swallow `--file`.
- `--collection <uuid>` and `--parent <uuid>` are optional. `--publish` publishes; without it the doc is a draft.

```bash
# Full help
bun scripts/create.js --help
```

### Update a document

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

### Templates
```bash
bun scripts/templates.js
bun scripts/templates.js --collection <id>
bun scripts/templates.js --id <template-uuid>
bun scripts/templates.js --json
```

### List documents
```bash
# All documents in a collection
bun scripts/list.js --collection <id>

# Direct children of a document (sub-issues / sub-pages)
bun scripts/list.js --parent <id>

# JSON output
bun scripts/list.js --parent <id> --json
```

### List collections
```bash
bun scripts/list-collections.js
bun scripts/list-collections.js --json
```

### Document tree
```bash
bun scripts/tree.js --collection <id>
bun scripts/tree.js --collection <id> --json
```

### Attachments

Outline uses a **two-phase upload**:
1. `attachments.create` with `name` / `contentType` / `size` / optional `documentId` (no base64) → `{ attachment, uploadUrl, form }`
2. multipart POST of the file to `uploadUrl` (often a relative `/api/files.create` or a signed S3 URL) with the `form` fields + `file`

`attachments.js --action create` does both steps. Stdout prints **ID**, **Path** (`/api/attachments.redirect?id=...`), and **MD** (`![name](/api/attachments.redirect?id=...)`) — paste the MD into the document.

```bash
# Attachments on a document
bun scripts/attachments.js --action list --document-id <id>

# Global attachment pool
bun scripts/attachments.js --action list

# Upload a file (content-type guessed from extension: jpg/png/webp/gif/pdf/md/...)
bun scripts/attachments.js --action create \
  --file ./diagram.png \
  --document-id <doc-id>

# Explicit name + content-type
bun scripts/attachments.js --action create \
  --file ./handoff.md \
  --name handoff.md \
  --content-type text/markdown \
  --document-id <doc-id>

# Download URL
bun scripts/attachments.js --action redirect --attachment-id <id>

# Delete an attachment
bun scripts/attachments.js --action delete --attachment-id <id>
```

### Create / update a collection
```bash
bun scripts/create-collection.js --name "Design" --description "Design and UI/UX"
bun scripts/create-collection.js --name "Private" --private --json

# Update an existing collection
bun scripts/update-collection.js --id <uuid> --name "New name"
bun scripts/update-collection.js --id <uuid> --description "..." --color "#FF5C80"
bun scripts/update-collection.js --id <uuid> --private
bun scripts/update-collection.js --id <uuid> --public
```

### Document history (revisions)
```bash
# List all revisions of a document
bun scripts/revisions.js --id <document-id>

# Show a specific revision (1 = newest)
bun scripts/revisions.js --id <document-id> --rev 1

# Show a revision by index (6 = sixth from the end)
bun scripts/revisions.js --id <document-id> --rev 6

# Show a revision by UUID
bun scripts/revisions.js --id <document-id> --rev <revision-uuid>

# JSON output
bun scripts/revisions.js --id <document-id> --json
```

### Delete
```bash
bun scripts/delete.js --id <id>               # Trash
bun scripts/delete.js --id <id> --permanent   # Permanent
```

### Archive
```bash
bun scripts/archive.js --id <id>              # Archive
bun scripts/archive.js --id <id> --restore    # Restore
```

### Duplicate
```bash
bun scripts/duplicate.js --id <id> --title "Copy of Doc"
bun scripts/duplicate.js --id <id> --recursive --publish  # Including child documents
```

### Move (change parent and/or collection)
```bash
# Change parent only, same collection (preferred)
bun scripts/move.js --id <id> --parent <parent-id>
# Change parent + move to another collection
bun scripts/move.js --id <id> --collection <new-coll-id> --parent <new-parent-id>
# Promote the document to the collection root
bun scripts/move.js --id <id> --parent null

# ⚠️ Outline API silently ignores unknown POST-body fields (e.g. a typo
# `parentDocument` instead of `parentDocumentId`) and returns ok:true
# with no actual change. The script post-checks via documents.info,
# and with --expect-parent it validates the result and exits 2
# if parentDocumentId on the server does not match the expectation.
bun scripts/move.js --id <id> --parent <parent-id> --expect-parent <parent-id>
```

> The field name is `parentDocumentId` (NOT `parentDocument`, NOT `parentId`).
> To change only the parent without changing collection, `documents.update` also accepts `parentDocumentId` (see `references/api-reference.md`).

### Export/Import
```bash
# Export
bun scripts/export.js --id <id> --output-file /absolute/path/in/workspace/doc.md
bun scripts/export.js --id <id> --include-children > full-export.md

# Import
bun scripts/import.js --file doc.md --title "Imported" --publish
cat document.md | bun scripts/import.js --title "From Stdin" --collection <id>
```

## 💡 Typical workflows

### 1. Search and update a document

```bash
# If you already have the URL slug (the /doc/...-XXXXX tail) — read it
# directly, no search:
bun scripts/read.js --id b9fqMIBlh9

# Otherwise search, take the ID/slug from the results, then read:
bun scripts/search.js --query "deployment guide"
bun scripts/read.js --id <id-or-slug>

# Append a section
echo "\n\n## Troubleshooting\n\n..." | bun scripts/update.js --id <id> --mode append

# Surgical replace: read first, then --mode patch --find / --find-file.
# Multiline replacement or code — via --text-file, not --text.
# Do not use --mode replace unless you are sending the full new document body.
```

### 2. Create technical documentation
```bash
# Create the parent page
echo "# API Documentation\n\nOverview..." | \
  bun scripts/create.js --title "API Docs" --collection <id> --publish

# Take the parent ID from the output

# Create child documents
echo "# Authentication\n\n..." | \
  bun scripts/create.js --title "Authentication" --parent <parent-id> --publish

echo "# Endpoints\n\n..." | \
  bun scripts/create.js --title "Endpoints" --parent <parent-id> --publish
```

### 3. Back up a collection
```bash
# Export every document
for doc_id in $(bun scripts/tree.js --collection <id> --json | jq -r '.[].id'); do
  bun scripts/export.js --id "$doc_id" --output-file "backup/$doc_id.md"
done
```

### 4. Get sub-issues / child pages
```bash
# `tree.js` only shows the first nesting level. For a deep walk,
# recurse with `list.js --parent=<id>`:
PARENT_ID="<root-doc-id>"
bun scripts/list.js --parent "$PARENT_ID" --json | jq -r '.[].id' | while read -r child; do
  echo "Child: $child"
  bun scripts/list.js --parent "$child" --json | jq -r '.[] | "  - \(.title)"'
done
```

### 5. Attach a handoff markdown to an issue
```bash
# Upload the file
bun scripts/attachments.js --action create \
  --file ./docs/agents/handoff/2026-06-XX.md \
  --name "phase-handoff.md" \
  --content-type text/markdown

# Take the ID from the output, then:
# 1. Copy the redirect URL from the create response
# 2. Add the link to the issue with update.js --mode append
```

### 6. Move a document to a new parent
```bash
# Check the current parent
bun scripts/read.js --id <doc-id> --json | jq '.data.parentDocumentId'

# Change parent (post-check catches a silent no-op from Outline API)
bun scripts/move.js --id <doc-id> --parent <new-parent-id> --expect-parent <new-parent-id>

# Exit code 2 — Outline ignored the field; check the name (`parentDocumentId`)
# and that you are not mixing endpoints: to change parent inside a collection,
# both documents.update (with parentDocumentId) and documents.move work.
```

## 📚 Documentation

- **[references/api-reference.md](references/api-reference.md)** — Outline API details
- **[references/examples.md](references/examples.md)** — Workflow examples

## 🔍 Debugging

Every script supports `--json` for programmatic use:
```bash
result=$(bun scripts/search.js --query "test" --json)
echo "$result" | jq '.data[0].document.title'
```

Verify auth and baseUrl:
```bash
bun scripts/test-connection.js
```

> ⚠️ **Before publishing a URL in chat / a document / an issue** — resolve the real origin with `test-connection.js`. The script returns an origin like `https://outline.<your-domain>` and confirms the connection. **Never** publish a URL from SKILL.md / config.example.json / README.md / references/*.md — those use the placeholder `your-outline.example.com` or `REPLACE_WITH_YOUR_OUTLINE_DOMAIN`.

## 🛠️ Development

**Skill layout:**
```
skills/outline/
├── SKILL.md                 # This documentation
├── README.md                # GitHub-oriented overview
├── LICENSE                  # MIT
├── config.example.json      # Template for config.json
├── config.json              # Local config (gitignored)
├── package.json             # Bun dependencies
├── scripts/
│   ├── search.js            # Search
│   ├── read.js              # Read
│   ├── create.js            # Create a document
│   ├── create-collection.js # Create a collection
│   ├── update.js            # Update
│   ├── delete.js            # Delete
│   ├── archive.js           # Archive
│   ├── duplicate.js         # Duplicate
│   ├── move.js              # Move (parent / collection) + post-check
│   ├── export.js            # Export markdown
│   ├── import.js            # Import markdown
│   ├── revisions.js         # Document history (revisions)
│   ├── tree.js              # Collection tree (depth 1)
│   ├── list.js              # Collection documents or children of a parent
│   ├── list-collections.js  # List collections
│   ├── attachments.js       # Attachments: list / create / delete / redirect
│   ├── test-connection.js   # Check auth and baseUrl
│   └── lib/
│       ├── outline-api.js   # Core API wrapper (reads OUTLINE_API_TOKEN)
│       └── temp-source.js   # Unlink --file paths under tmp/ after success
└── references/
    ├── api-reference.md     # API details
    └── examples.md          # Workflow examples
```

**API wrapper:** `scripts/lib/outline-api.js` is the single entry point for all Outline API requests.

**Namespace note:** in the current Outline version attachments live under `attachments.*` (not `documents.attachments.*`). `attachments.js` already accounts for this.

**Depth note in `tree.js`:** `collections.documents` only returns the first nesting level. For sub-pages use `list.js --parent=<id>` (as in workflow 4).
