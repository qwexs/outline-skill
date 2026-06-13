# outline-skill

> Thin CLI wrappers around the [Outline Wiki](https://www.getoutline.com/) REST API — search, read, create, update, archive — from the command line.

A small set of standalone Node.js scripts that map one-to-one to Outline's API endpoints. Designed to be composed by other tools (agents, scripts, CI) rather than called directly by humans.

## Why

- One script per endpoint — easy to read, easy to extend
- `--json` output on every script for programmatic use
- Bearer-token auth via `config.json` (or `OUTLINE_API_TOKEN` env var on the `feat/env-token` branch)
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

The skill reads its config from `config.json` (gitignored):

```json
{
  "baseUrl": "https://your-outline.example.com/api",
  "apiToken": "ol_api_..."
}
```

`baseUrl` must point at the `/api` endpoint of your Outline instance. `apiToken` is the API token from **Settings → API Tokens** in the Outline UI.

> **Prefer env vars?** The `feat/env-token` branch reads `OUTLINE_API_TOKEN` from the environment first and falls back to `config.apiToken`. Check it out with `git switch feat/env-token` until it lands on `main`.

Verify the setup:

```bash
bun scripts/test-connection.js
```

## Quick start

```bash
# Search for documents
bun scripts/search.js --query "deployment guide"

# Read a document by id
bun scripts/read.js --id <document-uuid>

# Create a document
echo "# My Document\n\nHello" | bun scripts/create.js \
  --title "My Document" --collection <id> --publish

# Update a document (append mode)
echo "\n\n## New section" | bun scripts/update.js \
  --id <id> --mode append

# List collections
bun scripts/list-collections.js
```

Every script supports `--json` for machine-readable output and `--help` for the full flag reference.

## Commands

| Script | Purpose |
|---|---|
| `search.js` | Full-text search with context snippets |
| `read.js` | Get a document by id or share id |
| `create.js` | Create a document (stdin or `--text`) |
| `create-collection.js` | Create a collection |
| `update.js` | Update a document (`replace` / `append` / `prepend`) |
| `delete.js` | Move to trash (`--permanent` to delete forever) |
| `archive.js` | Archive / restore a document |
| `duplicate.js` | Duplicate a document (`--recursive` for sub-tree) |
| `tree.js` | Show hierarchical structure of a collection |
| `list-collections.js` | List all collections |
| `export.js` | Export a document as markdown |
| `import.js` | Import a markdown file as a new document |
| `revisions.js` | List / inspect document revisions |
| `test-connection.js` | Verify auth and baseUrl |

Every script is a thin wrapper around one Outline API endpoint — no client library to keep in sync.

## Related skills

- [`qwexs/issue-lifecycle`](https://github.com/qwexs/issue-lifecycle) — manages the full lifecycle of `ISS-N` issues on Outline (create from a brief, log progress, close with outcome). Uses this skill under the hood.

## License

MIT — see [`LICENSE`](LICENSE).
