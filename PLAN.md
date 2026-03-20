# Outline Skill Development Plan

**Target:** your-outline.example.com  
**API Token:** `ol_api_YOUR_TOKEN_HERE`  
**Tech Stack:** Bun.js  
**Approach:** Decomposition into sub-agent tasks

---

## Phase 1: Foundation (Sub-agent 1) — 15 min

**Task:** Create base API wrapper + config

**Deliverables:**
1. `config.json` — API token + base URL
2. `scripts/lib/outline-api.js` — Core API wrapper:
   - `makeRequest(endpoint, body)` — POST request handler
   - Authentication headers
   - Error handling
   - Response parsing (data/policies/pagination)
3. `package.json` — bun dependencies (only what's needed, minimal)
4. Test connection script

**Files:**
```
skills/outline/
├── config.json
├── package.json
└── scripts/
    └── lib/
        └── outline-api.js
```

**Validation:** Can make a test request to `collections.list`

---

## Phase 2: Core Operations (Sub-agent 2) — 20 min

**Task:** Implement essential CRUD operations

**Scripts to create:**
1. `scripts/search.js` — Search documents
   - Args: `--query`, `--collection`, `--date-filter`
   - Output: matched documents with context snippets
   
2. `scripts/read.js` — Read document by ID
   - Args: `--id` or `--share-id`
   - Output: title + markdown content
   
3. `scripts/create.js` — Create document
   - Args: `--title`, `--text`, `--collection`, `--parent`, `--publish`
   - Support stdin for text content
   - Output: created document ID + URL
   
4. `scripts/update.js` — Update document
   - Args: `--id`, `--title`, `--text`, `--mode` (replace/append/prepend)
   - Support stdin for text
   - Output: updated document info
   
5. `scripts/list-collections.js` — List collections
   - Output: collection ID, name, document count

**Common features:**
- All scripts use `lib/outline-api.js`
- JSON output mode (`--json` flag)
- Human-readable default output
- Error messages to stderr

**Files:**
```
scripts/
├── search.js
├── read.js
├── create.js
├── update.js
├── list-collections.js
└── lib/
    └── outline-api.js
```

**Validation:** Each script works standalone via `bun run`

---

## Phase 3: Advanced Features (Sub-agent 3) — 20 min

**Task:** Implement tree operations + bulk actions

**Scripts:**
1. `scripts/tree.js` — Show collection document tree
   - Args: `--collection`
   - Output: hierarchical tree (ASCII or JSON)
   
2. `scripts/delete.js` — Delete document
   - Args: `--id`, `--permanent` (optional)
   - Output: confirmation
   
3. `scripts/archive.js` — Archive/restore document
   - Args: `--id`, `--restore` (optional)
   
4. `scripts/duplicate.js` — Duplicate document
   - Args: `--id`, `--title`, `--recursive`, `--collection`
   
5. `scripts/export.js` — Export document as markdown
   - Args: `--id`, `--include-children`, `--output`
   
6. `scripts/import.js` — Import markdown file
   - Args: `--file`, `--collection`, `--parent`, `--title`

**Files:**
```
scripts/
├── tree.js
├── delete.js
├── archive.js
├── duplicate.js
├── export.js
└── import.js
```

**Validation:** Tree display works, import/export round-trip preserves content

---

## Phase 4: Documentation + SKILL.md (Sub-agent 4) — 15 min

**Task:** Write comprehensive documentation

**Deliverables:**
1. `SKILL.md` — Main skill documentation:
   - Description (what Outline is, what skill does)
   - Installation (`bun install`)
   - Configuration (your-outline.example.com, API token)
   - Usage examples for each script
   - Common workflows
   
2. `references/api-reference.md` — API details:
   - Copy research findings
   - Endpoint reference
   - Response formats
   - Error codes
   
3. `references/examples.md` — Workflow examples:
   - Search knowledge base
   - Create technical documentation
   - Update existing docs (append mode)
   - Build doc hierarchy
   - Export collection for backup

**Files:**
```
├── SKILL.md
└── references/
    ├── api-reference.md
    └── examples.md
```

---

## Phase 5: Integration + Testing (Manual) — 10 min

**Task:** Test against your-outline.example.com

**Manual steps:**
1. Run `bun install` in skill directory
2. Test `list-collections.js` → verify connection
3. Create test document → verify creation
4. Search for test document → verify search
5. Update test document (append) → verify update
6. Export test document → verify markdown export
7. Delete test document → cleanup

**Validation checklist:**
- [ ] API authentication works
- [ ] Collections list returns data
- [ ] Document CRUD operations work
- [ ] Search returns relevant results
- [ ] Tree display shows hierarchy
- [ ] Import/export preserves content
- [ ] Error handling graceful

---

## Skill Structure (Final)

```
skills/outline/
├── SKILL.md              # Main documentation
├── config.json           # API token + base URL
├── package.json          # bun dependencies
├── scripts/
│   ├── search.js         # Search documents
│   ├── read.js           # Read document
│   ├── create.js         # Create document
│   ├── update.js         # Update document
│   ├── delete.js         # Delete document
│   ├── archive.js        # Archive/restore
│   ├── duplicate.js      # Duplicate document
│   ├── export.js         # Export markdown
│   ├── import.js         # Import markdown
│   ├── tree.js           # Show doc tree
│   ├── list-collections.js  # List collections
│   └── lib/
│       └── outline-api.js   # Core API wrapper
└── references/
    ├── api-reference.md  # API endpoint reference
    └── examples.md       # Usage examples
```

---

## Orchestration Plan

**Sub-agent execution order:**
1. **Phase 1** (foundation) → blocks Phase 2
2. **Phase 2** (core ops) → blocks Phase 3
3. **Phase 3** (advanced) → independent after Phase 2
4. **Phase 4** (docs) → independent after Phase 2
5. **Phase 5** (testing) → manual after all phases

**Estimated total time:** ~1 hour (15+20+20+15+10)

**Dependencies:**
- Phase 2, 3, 4 depend on Phase 1 (API wrapper)
- Phase 3, 4 can run in parallel after Phase 2
- Phase 5 is manual validation

---

## Key Implementation Notes

1. **All API requests are POST** — no GET/PUT/DELETE verbs
2. **Authentication:** `Authorization: Bearer ${API_TOKEN}` header
3. **Content-Type:** `application/json` (except import which is multipart)
4. **Base URL:** `https://your-outline.example.com/api/`
5. **Markdown native:** text field always contains markdown
6. **editMode crucial:** use "append" to add content without overwriting
7. **publish: true** needed for visibility (or inherit from parentDocumentId)
8. **Error handling:** Outline returns `{ok: false, message: "..."}` on errors

---

## Next Steps

**Ready to execute?**
- Phase 1 → spawn sub-agent for foundation
- Phase 2 → spawn sub-agent for core scripts
- Phase 3 → spawn sub-agent for advanced scripts
- Phase 4 → spawn sub-agent for documentation
- Phase 5 → manual testing + adjustments

**Awaiting confirmation to start Phase 1...**
