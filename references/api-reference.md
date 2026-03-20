# Outline API Reference

API reference для Outline Wiki (your-outline.example.com).

## Общие принципы

- **Все запросы — POST** (даже чтение данных)
- **Base URL:** `https://your-outline.example.com/api/`
- **Auth:** `Authorization: Bearer <API_TOKEN>`
- **Content-Type:** `application/json`
- **Ответ:** `{ ok: true, data: {...}, pagination: {...}, policies: [...] }`
- **Ошибка:** `{ ok: false, error: "error_type", message: "описание" }`

## Аутентификация

```bash
curl -X POST https://your-outline.example.com/api/auth.info \
  -H "Authorization: Bearer ol_api_..." \
  -H "Content-Type: application/json"
```

## Endpoints

### Documents

#### `documents.search`
Full-text поиск по документам.

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

**Параметры:**
| Поле | Тип | Описание |
|------|-----|----------|
| `query` | string | Поисковый запрос (обязательный) |
| `collectionId` | string | Фильтр по коллекции |
| `userId` | string | Фильтр по автору |
| `dateFilter` | string | `day`, `week`, `month`, `year` |
| `limit` | number | Макс. результатов (default 25) |
| `offset` | number | Смещение для пагинации |

**Ответ:**
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
Получение документа по ID.

```bash
curl -X POST https://your-outline.example.com/api/documents.info \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

**Параметры:**
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | UUID документа |
| `shareId` | string | Публичный share ID (альтернатива id) |

**Ответ:** `{ ok: true, data: { id, title, text, emoji, collectionId, parentDocumentId, ... } }`

#### `documents.create`
Создание нового документа.

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

**Параметры:**
| Поле | Тип | Описание |
|------|-----|----------|
| `title` | string | Заголовок (обязательный) |
| `text` | string | Markdown контент |
| `collectionId` | string | ID коллекции (обязательный) |
| `parentDocumentId` | string | ID родительского документа |
| `publish` | boolean | Опубликовать сразу |
| `template` | boolean | Создать как шаблон |

#### `documents.update`
Обновление документа.

```bash
curl -X POST https://your-outline.example.com/api/documents.update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "document-uuid",
    "title": "Updated Title",
    "text": "New content",
    "append": true
  }'
```

**Параметры:**
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | UUID документа (обязательный) |
| `title` | string | Новый заголовок |
| `text` | string | Новый контент |
| `append` | boolean | Добавить text в конец (вместо замены) |

**Важно:** `append: true` — ключевой параметр для добавления контента без перезаписи.

#### `documents.delete`
Удаление документа.

```bash
curl -X POST https://your-outline.example.com/api/documents.delete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid", "permanent": false}'
```

**Параметры:**
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | UUID документа |
| `permanent` | boolean | Удалить навсегда (default: false → в корзину) |

#### `documents.archive`
Архивация документа.

```bash
curl -X POST https://your-outline.example.com/api/documents.archive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

#### `documents.unarchive`
Восстановление из архива.

```bash
curl -X POST https://your-outline.example.com/api/documents.unarchive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

#### `documents.duplicate`
Дублирование документа.

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

**Параметры:**
| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | UUID исходного документа |
| `title` | string | Заголовок копии |
| `publish` | boolean | Опубликовать копию |
| `recursive` | boolean | Копировать child документы |
| `collectionId` | string | Поместить в другую коллекцию |

#### `documents.export`
Экспорт документа.

```bash
curl -X POST https://your-outline.example.com/api/documents.export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "document-uuid"}'
```

Возвращает markdown контент документа.

#### `documents.import`
Импорт документа (multipart/form-data).

```bash
curl -X POST https://your-outline.example.com/api/documents.import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.md" \
  -F "collectionId=collection-uuid" \
  -F "publish=true"
```

**Параметры (form fields):**
| Поле | Тип | Описание |
|------|-----|----------|
| `file` | file | Markdown файл |
| `collectionId` | string | ID коллекции |
| `parentDocumentId` | string | ID родителя |
| `publish` | boolean | Опубликовать |

### Collections

#### `collections.list`
Список коллекций.

```bash
curl -X POST https://your-outline.example.com/api/collections.list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Ответ:**
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
Документы в коллекции (иерархия).

```bash
curl -X POST https://your-outline.example.com/api/collections.documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "collection-uuid"}'
```

**Ответ:** Возвращает вложенную структуру документов:
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

## Пагинация

Endpoints со списками поддерживают пагинацию:
```json
{
  "offset": 0,
  "limit": 25
}
```

Передавайте `offset` и `limit` в теле запроса. Ответ содержит `pagination` объект.

## Коды ошибок

| Код | Описание |
|-----|----------|
| 401 | Неверный или отсутствующий API token |
| 403 | Нет прав на операцию |
| 404 | Документ/коллекция не найдены |
| 400 | Неверные параметры запроса |

## Лимиты

- Размер документа: до ~1MB markdown
- Rate limiting: ~120 запросов/минуту (зависит от инстанса)
- Поиск: максимум 100 результатов за запрос
