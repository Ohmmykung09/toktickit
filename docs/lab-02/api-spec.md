# Lab 2 API Specification

## 1. Conventions

- Base URL during local development: `http://localhost:3000`.
- Request and response bodies use JSON except file uploads, which use `multipart/form-data`.
- Lab 2 requester context is supplied with the `X-Development-Requester-Id` request header. It is a temporary testing mechanism, not authentication.
- Successful responses use `200 OK` or `201 Created`. Validation failures use `400 Bad Request`; missing records use `404 Not Found`; ownership failures use `403 Forbidden`; a reused idempotency key with different ticket data uses `409 Conflict`; file size/type failures use `400 Bad Request`; unexpected failures use `500 Internal Server Error`.
- Error response format: `{ "error": "Safe user-facing message" }`.

## 2. Lookup Endpoints

### GET /api/development-requesters

Returns active Development Requesters for the Lab 2 selector.

Response `200 OK`:

```json
[{ "id": 1, "name": "Aom S." }]
```

### GET /api/categories

Returns active Categories ordered by name.

### GET /api/related-systems

Returns active Related Systems ordered by name.

## 3. Ticket Endpoints

### POST /api/tickets

Creates a ticket for the selected requester.

Headers:

```text
X-Development-Requester-Id: <integer>
Idempotency-Key: <UUID generated once for one submit action>
```

Request:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Cannot connect to campus Wi-Fi",
  "requestedPriority": "HIGH",
  "description": "The connection fails after selecting the campus Wi-Fi network."
}
```

Response `201 Created`:

```json
{
  "ticketNumber": "TKT-20260820-0001",
  "status": "New",
  "createdAt": "2026-08-20T10:30:00.000Z"
}
```

The backend validates requester activity, lookup values, trimmed field lengths, and priority values. The Ticket Number and initial status are system-managed values.

#### Duplicate Request Behaviour

- The backend stores the `Idempotency-Key` atomically with the newly created ticket and scopes it to the selected requester.
- The first valid request for a key returns `201 Created`.
- A retry with the same key and identical ticket payload returns `200 OK` with the original ticket response and does not create another Ticket.
- Reusing the same key with a different ticket payload returns `409 Conflict` with a safe error message.
- The frontend creates one UUID per submit action and reuses it only when retrying that same action.

### GET /api/tickets

Returns tickets owned by the selected requester.

Headers: `X-Development-Requester-Id: <integer>`

Query parameters:

| Parameter | Description |
| --- | --- |
| `q` | Optional text search across Ticket Number and Summary. |
| `categoryId` | Optional active or historical category ID. |
| `status` | Optional ticket status. Lab 2 uses `New`. |
| `priority` | Optional requested priority. |
| `sort` | `updatedAt`, `createdAt`, or `ticketNumber`; default `updatedAt`. |
| `direction` | `asc` or `desc`; default `desc`. |
| `page` | Positive page number; default `1`. |
| `pageSize` | Integer from `5` to `50`; default `10`. |

Response `200 OK`:

```json
{
  "items": [
    {
      "ticketNumber": "TKT-20260820-0001",
      "summary": "Cannot connect to campus Wi-Fi",
      "category": { "id": 1, "name": "Network" },
      "status": "New",
      "requestedPriority": "High",
      "updatedAt": "2026-08-20T10:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1 }
}
```

Invalid query parameters return `400 Bad Request`.

### GET /api/tickets/:ticketNumber

Returns full ticket details and active or soft-removed attachment metadata when the selected requester owns the ticket. Removed metadata includes `removedAt` and `removalReason`. A ticket that does not exist returns `404`; a ticket owned by another requester returns `403` without returning its data.

## 4. Attachment Endpoints

### POST /api/tickets/:ticketNumber/attachments

Uploads one attachment using `multipart/form-data` field name `file`.

The selected requester must own the ticket. The backend accepts only JPG, JPEG, PNG, WEBP, and PDF files up to 5 MB and allows at most five active attachments.

Response `201 Created` includes attachment ID, original file name, MIME type, size, upload time, and null removal fields. Internal storage names and ownership foreign keys are never returned.

### GET /api/tickets/:ticketNumber/attachments

Returns active and soft-removed attachment metadata for a ticket owned by the selected requester. Soft-removed records remain visible for audit.

### GET /api/tickets/:ticketNumber/attachments/:attachmentId/download

Downloads an active attachment belonging to a ticket owned by the selected requester. Removed files return `404`.

### DELETE /api/tickets/:ticketNumber/attachments/:attachmentId

Soft-removes an active attachment belonging to a ticket owned by the selected requester.

Request:

```json
{ "reason": "Uploaded the wrong evidence file." }
```

The trimmed reason is required and must contain 3 to 500 characters. The response is `200 OK` with public attachment metadata, `removedAt`, and `removalReason`. Removed metadata remains in list and detail responses, while download returns `404`.

## 5. Failure Behaviour

- The API never returns raw Prisma errors or database connection details.
- Invalid requester context, inactive requester, malformed request, invalid filters, and unsupported files return safe explanatory messages.
- The frontend retains completed form values after an API failure so the requester can correct or retry the action.
