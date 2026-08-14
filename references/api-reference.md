# Outline API Reference

API reference for Outline Wiki (your-outline.example.com).

## General rules

- **Every request is POST** (including reads)
- **Base URL:** `https://your-outline.example.com/api/`
- **Auth:** `Authorization: Bearer <API_TOKEN>`
- **Content-Type:** `application/json`
- **Success:** `{ ok: true, data: {...}, pagination: {...}, policies: [...] }`
- **Error:** `{ ok: false, error: "error_type", message: "description" }`

## Authentication

```bash
curl -X POST https://your-outline.example.com/api/auth.info \
  -H "Authorization: Bearer ol_api_..." \
  -H "Content-Type: application/json"
```

## Endpoints

### Documents

#### `documents.search`
Full-text search over documents.

```bash
curl -X POST https://your-outline.example.com/api/documents.search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "deployment",
    "collectionId": "optional-collection-id",
    "dateFilter": "month",
    "limit": 25,
    "offset": 0
  }'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `query` | string | Search query (required) |
| `collectionId` | string | Filter by collection |
| `userId` | string | Filter by author |
| `dateFilter` | string | `day`, `week`, `month`, `year` |
| `limit` | number | Max results (default 25) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "ranking": 0.95,
      "context": "...matched <b>text</b>...",
      "document": {
        "id": "doc-uuid",
        "title": "Deployment Guide",
        "text": "# Deployment Guide\n\n...",
        "collectionId": "col-uuid",
        "createdAt": "2026-01-15T10:00:00.000Z",
        "updatedAt": "2026-02-01T15:30:00.000Z",
        "publishedAt": "2026-01-15T10:00:00.000Z",
        "url": "/doc/deployment-guide-abc123"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 25
  }
}
```

#### `documents.info`
Fetch a document by ID.

```bash
curl -X POST https://your-outline.example.com/api/documents.info \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `id` | string | Document UUID |
| `shareId` | string | Public share ID (alternative to id) |

**Response:** `{ ok: true, data: { id, title, text, emoji, collectionId, parentDocumentId, ... } }`

#### `documents.create`
Create a new document.

```bash
curl -X POST https://your-outline.example.com/api/documents.create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Document",
    "text": "# Content\n\nMarkdown here",
    "collectionId": "collection-uuid",
    "parentDocumentId": "parent-uuid",
    "publish": true
  }'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `title` | string | Title (required unless templateId is set) |
| `text` | string | Markdown body |
| `collectionId` | string | Collection ID |
| `parentDocumentId` | string | Parent document ID |
| `templateId` | string | Template UUID to prefill (`templates.list`) |
| `publish` | boolean | Publish immediately |
| `template` | boolean | Create as a template |

#### `documents.update`
Update a document.

```bash
curl -X POST https://your-outline.example.com/api/documents.update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "document-uuid",
    "title": "Updated Title",
    "text": "New content",
    "editMode": "append"
  }'
```

**Patch (surgical edit, preferred for agents):**
```bash
curl -X POST https://your-outline.example.com/api/documents.update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "document-uuid",
    "editMode": "patch",
    "findText": "## Old section\n\nparagraph",
    "text": "## New section\n\nupdated paragraph",
    "done": true
  }'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `id` | string | Document UUID (required) |
| `title` | string | New title |
| `text` | string | New body / replacement for patch |
| `editMode` | string | `replace` \| `append` \| `prepend` \| `patch` |
| `findText` | string | Exact markdown substring for `editMode=patch` (required) |
| `append` | boolean | **Deprecated** — use `editMode: "append"` |
| `parentDocumentId` | string \| null | Change parent. UUID or `null` (collection root) |
| `done` | boolean | Finish the editing session |

**Important:** for surgical agent edits prefer `editMode: "patch"` + `findText` — it keeps rich formatting outside the match. `append: true` still works (mapped to `editMode=append`) but is deprecated.

#### `collections.update`

```bash
curl -X POST https://your-outline.example.com/api/collections.update \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "collection-uuid",
    "name": "New name",
    "description": "Updated description",
    "color": "#FF5C80",
    "permission": "read"
  }'
```

**Parameters:** `id` (required), `name`, `description`, `color`, `icon`, `permission` (`read` / empty for private).

CLI: `bun scripts/update-collection.js --id <uuid> --name "..."`

#### `templates.list` / `templates.info`

```bash
curl -X POST https://your-outline.example.com/api/templates.list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 25}'

curl -X POST https://your-outline.example.com/api/templates.info \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "template-uuid"}'
```

#### `documents.delete`
Delete a document.

```bash
curl -X POST https://your-outline.example.com/api/documents.delete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid", "permanent": false}'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `id` | string | Document UUID |
| `permanent` | boolean | Delete forever (default: false → trash) |

#### `documents.archive`
Archive a document.

```bash
curl -X POST https://your-outline.example.com/api/documents.archive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

#### `documents.unarchive`
Restore from archive.

```bash
curl -X POST https://your-outline.example.com/api/documents.unarchive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

#### `documents.move`
Move a document to another collection and/or change its parent inside a collection.

```bash
curl -X POST https://your-outline.example.com/api/documents.move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "document-uuid",
    "collectionId": "target-collection-uuid",
    "parentDocumentId": "target-parent-uuid"
  }'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `id` | string | Document UUID (required) |
| `collectionId` | string | Target collection ID (required when moving to another collection) |
| `parentDocumentId` | string \| null | New parent inside the collection, or `null` to place at the collection root |

**⚠️ Gotcha.** Outline API **silently ignores unknown fields** in the POST body and returns `ok: true` together with the current (unchanged) document. Parameter names are fixed: `parentDocumentId` (NOT `parentDocument`, NOT `parentId`). To confirm a move actually happened, post-check via `documents.info` and compare `parentDocumentId` / `collectionId` with the expected values.

**When to use which:**
- Changing only the parent inside one collection → `documents.update` with `parentDocumentId` (cheaper, no `collectionId` required).
- Moving to another collection (and optionally setting a parent) → `documents.move`.

#### `documents.duplicate`
Duplicate a document.

```bash
curl -X POST https://your-outline.example.com/api/documents.duplicate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "document-uuid",
    "title": "Copy of Document",
    "publish": true,
    "recursive": true
  }'
```

**Parameters:**
| Field | Type | Description |
|------|-----|----------|
| `id` | string | Source document UUID |
| `title` | string | Copy title |
| `publish` | boolean | Publish the copy |
| `recursive` | boolean | Also copy child documents |
| `collectionId` | string | Place the copy in another collection |

#### `documents.export`
Export a document.

```bash
curl -X POST https://your-outline.example.com/api/documents.export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

Returns the document markdown.

#### `documents.import`
Import a document (multipart/form-data).

```bash
curl -X POST https://your-outline.example.com/api/documents.import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.md" \
  -F "collectionId=collection-uuid" \
  -F "publish=true"
```

**Parameters (form fields):**
| Field | Type | Description |
|------|-----|----------|
| `file` | file | Markdown file |
| `collectionId` | string | Collection ID |
| `parentDocumentId` | string | Parent ID |
| `publish` | boolean | Publish |

### Collections

#### `collections.list`
List collections.

```bash
curl -X POST https://your-outline.example.com/api/collections.list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "collection-uuid",
      "name": "Engineering",
      "description": "Technical documentation",
      "documents": [],
      "color": "#4E5C6E",
      "icon": "collection",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-02-01T00:00:00.000Z"
    }
  ]
}
```

#### `collections.documents`
Documents in a collection (hierarchy).

```bash
curl -X POST https://your-outline.example.com/api/collections.documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "collection-uuid"}'
```

**Response:** Nested document structure:
```json
{
  "ok": true,
  "data": [
    {
      "id": "doc-uuid",
      "title": "Getting Started",
      "url": "/doc/getting-started-abc",
      "children": [
        {
          "id": "child-uuid",
          "title": "Installation",
          "url": "/doc/installation-def",
          "children": []
        }
      ]
    }
  ]
}
```

## Pagination

List endpoints support pagination:
```json
{
  "offset": 0,
  "limit": 25
}
```

Pass `offset` and `limit` in the request body. The response includes a `pagination` object.

## Error codes

| Code | Description |
|-----|----------|
| 401 | Invalid or missing API token |
| 403 | No permission for the operation |
| 404 | Document/collection not found |
| 400 | Invalid request parameters |

## Limits

- Document size: up to ~1MB of markdown
- Rate limiting: ~120 requests/minute (depends on the instance)
- Search: at most 100 results per request
