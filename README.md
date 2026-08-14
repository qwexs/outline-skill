# outline-skill

> Thin CLI wrappers around the [Outline Wiki](https://www.getoutline.com/) REST API — search, read, create, update, archive — from the command line.

A small set of standalone Node.js scripts that map one-to-one to Outline's API endpoints. Designed to be composed by other tools (agents, scripts, CI) rather than called directly by humans.

## Why

- One script per endpoint — easy to read, easy to extend
- `--json` output on every script for programmatic use
- Multi-instance: `--instance` / `OUTLINE_API_TOKEN_<NAME>` (+ legacy `OUTLINE_API_TOKEN` for default)
- Zero npm dependencies
- ESM, runs on Node 18+ and Bun

## Install

```bash
git clone https://github.com/qwexs/outline-skill.git ~/.agents/skills/outline-skill
cd ~/.agents/skills/outline-skill
# Create your local config — see Configuration below
touch config.json && $EDITOR config.json
```

No `bun install` / `npm install` step.

## Configuration

Multi-instance is first-class. `config.json` (gitignored) holds hosts only — tokens stay in env.

```json
{
  "defaultInstance": "work",
  "instances": {
    "work": { "baseUrl": "https://outline.example.com/api" },
    "personal": { "baseUrl": "https://other.example.com/api" }
  }
}
```

Legacy single-host shape still works: `{ "baseUrl": "https://.../api" }`. Instance names are arbitrary keys; env suffix is `UPPER_SNAKE(name)`.

### Tokens

| Priority | Source |
|---|---|
| 1 | `OUTLINE_API_TOKEN_<NAME>` (e.g. `OUTLINE_API_TOKEN_PERSONAL`) |
| 2 | `OUTLINE_API_TOKEN` — **default instance only** (compat) |
| 3 | `instances.<name>.apiToken` / top-level `apiToken` (discouraged) |

```bash
export OUTLINE_API_TOKEN_WORK="ol_api_..."
export OUTLINE_API_TOKEN_PERSONAL="ol_api_..."
export OUTLINE_API_TOKEN="$OUTLINE_API_TOKEN_WORK"  # optional default alias
```

Never commit real tokens or private hostnames you do not want public. Keep `config.json` gitignored (hosts only).

### Picking an instance

Every script accepts `--instance <name>` / `-i <name>`. Else: `OUTLINE_INSTANCE` env → `config.defaultInstance`.

```bash
bun scripts/test-connection.js --all
bun scripts/list-collections.js --instance personal
bun scripts/search.js --query "deploy" -i personal
```

## Quick start

```bash
# Search for documents (default instance)
bun scripts/search.js --query "deployment guide"

# Same on another instance
bun scripts/search.js --query "deployment guide" --instance personal

# Read a document by id
bun scripts/read.js --id <document-uuid>

# Create a document
echo "# My Document\n\nHello" | bun scripts/create.js \
  --title "My Document" --collection <id> --publish

# Surgically update a document (the safe default for edits)
bun scripts/update.js --id <id> --mode patch \
  --find "Old wording" --text "New wording"

# Replace the entire body only when that is intentional
echo "# Complete new document" | bun scripts/update.js \
  --id <id> --mode replace

# List collections
bun scripts/list-collections.js
```

Every script supports `--json` for machine-readable output and `--help` for the full flag reference.

## Commands

| Script | Purpose |
|---|---|
| `search.js` | Full-text search with context snippets |
| `read.js` | Get a document by id or share id |
| `create.js` | Create a document (`--file`, stdin, or `--text`) |
| `create-collection.js` | Create a collection |
| `update.js` | Update a document (`patch` / `append` / `prepend` / explicit `replace`; `--text-file` / stdin / `--text`) |
| `delete.js` | Move to trash (`--permanent` to delete forever) |
| `archive.js` | Archive / restore a document |
| `duplicate.js` | Duplicate a document (`--recursive` for sub-tree) |
| `tree.js` | Show hierarchical structure of a collection |
| `list.js` | List documents in a collection, or children of a parent document |
| `list-collections.js` | List all collections |
| `export.js` | Export a document as markdown |
| `import.js` | Import a markdown file as a new document |
| `revisions.js` | List / inspect document revisions |
| `attachments.js` | Manage file attachments (`list` / `create` / `delete` / `redirect`) |
| `test-connection.js` | Verify auth and baseUrl |

Every script is a thin wrapper around one Outline API endpoint — no client library to keep in sync.

### Safe updates

`update.js` requires an explicit `--mode` whenever document text changes, so an omitted flag can never silently replace the full body. For targeted edits use `--mode patch --find "exact current markdown" --text "replacement"`; the command first verifies that the fragment occurs exactly once. Supplying `--find` / `--find-file` without `--mode` also infers `patch` safely. Use `--mode replace` only when supplying the complete replacement body. For multiline markdown or anything with backticks, pass the body via `--text-file` or stdin — not `--text`.

## Related skills

- [`qwexs/issue-lifecycle`](https://github.com/qwexs/issue-lifecycle) — manages the full lifecycle of `ISS-N` issues on Outline (create from a brief, log progress, close with outcome). Uses this skill under the hood.

## License

MIT — see [`LICENSE`](LICENSE).
