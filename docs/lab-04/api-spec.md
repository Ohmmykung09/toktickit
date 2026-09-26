# Lab 4 API Specification

## 1. API Conventions

- Base URL: `/api`.
- Protected endpoints require the existing authenticated HttpOnly session cookie.
- State-changing requests require the approved Origin and session CSRF token.
- IDs are numeric database identifiers unless a route explicitly uses a Ticket Number or an Action Taken ID.
- Dates are ISO 8601 UTC strings.
- Successful list responses use arrays or documented concise objects. They never expose password hashes, session tokens, storage paths, or internal secrets.
- Unexpected errors use a generic JSON response and do not expose stack traces.

## 2. Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "fieldErrors": {
      "followUpNote": "A follow-up note is required when follow-up is selected."
    }
  }
}
```

| Status | Meaning |
| --- | --- |
| `400` | Malformed body, invalid field, or invalid query. |
| `401` | Missing, expired, revoked, or invalid session. |
| `403` | Authenticated role is not permitted. |
| `404` | Ticket or Action Taken is missing or not visible to the actor. |
| `409` | Invalid workflow transition or stale optimistic-concurrency value. |
| `413` | Payload is too large where the existing attachment limits apply. |
| `500` | Safe unexpected server failure without internal details. |

## 3. Actions Taken

### List Actions Taken

`GET /api/tickets/:ticketNumber/actions-taken`

Allowed roles: Requester for an owned Ticket, IT Staff, or Administrator.

Response `200`:

```json
[
  {
    "id": 41,
    "actionDateTime": "2026-09-27T08:30:00.000Z",
    "description": "Checked the access point and replaced the damaged cable.",
    "result": "Link restored and connectivity verified.",
    "performedBy": {
      "id": 6,
      "name": "Ploy IT",
      "role": "IT_STAFF"
    },
    "followUpRequired": true,
    "followUpNote": "Confirm stability with the requester tomorrow.",
    "attachmentNotes": "Look for the cable replacement photo.",
    "createdAt": "2026-09-27T08:31:00.000Z",
    "updatedAt": "2026-09-27T08:31:00.000Z"
  }
]
```

The list is ordered by `actionDateTime ASC, id ASC`. Cross-owner Requester access returns the same `404 RESOURCE_NOT_FOUND` shape as a missing Ticket.

### Create Action Taken

`POST /api/staff/tickets/:ticketNumber/actions-taken`

Allowed roles: IT Staff and Administrator.

Request:

```json
{
  "actionDateTime": "2026-09-27T08:30:00.000Z",
  "description": "Checked the access point and replaced the damaged cable.",
  "result": "Link restored and connectivity verified.",
  "followUpRequired": true,
  "followUpNote": "Confirm stability with the requester tomorrow.",
  "attachmentNotes": "Look for the cable replacement photo."
}
```

The server derives `performedBy` from the session. Client-supplied `performedBy`, `performedById`, `ticketId`, and `ownerId` fields are rejected or ignored and never control authorship.

Response `201`: the created Action Taken using the response shape above.

### Update Action Taken

`PATCH /api/staff/tickets/:ticketNumber/actions-taken/:actionId`

Allowed roles: IT Staff and Administrator.

Request:

```json
{
  "actionDateTime": "2026-09-27T08:45:00.000Z",
  "description": "Checked the access point and replaced the damaged cable.",
  "result": "Verified stable connectivity from two locations.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "",
  "expectedUpdatedAt": "2026-09-27T08:31:00.000Z"
}
```

Response `200`: the authoritative updated Action Taken. A stale `expectedUpdatedAt` returns `409 STALE_WRITE` and leaves the stored record unchanged.

## 4. Ticket Workflow

### Update Status

`PATCH /api/staff/tickets/:ticketNumber/status`

Allowed roles: IT Staff and Administrator.

Request:

```json
{
  "status": "RESOLVED",
  "expectedUpdatedAt": "2026-09-27T08:31:00.000Z"
}
```

Response `200`: the updated Staff Ticket Detail summary.

The backend checks, in order:

1. The status value is a permitted enum value.
2. The current Ticket exists and is visible to the Staff role.
3. The requested transition exists in the matrix.
4. A required active owner exists.
5. `expectedUpdatedAt` still matches the current Ticket.

Invalid transitions return `409 INVALID_STATUS_TRANSITION`. Missing ownership returns `409 OWNER_REQUIRED`. A stale value returns `409 STALE_WRITE`. A transition to the current status returns `400 VALIDATION_ERROR`.

### Requester Resolution Indication

`POST /api/tickets/:ticketNumber/problem-appears-resolved`

Allowed role: Requester for an owned Ticket.

The endpoint records the authenticated Requester and UTC timestamp. It does not change `Ticket.status`. Repeated requests are idempotent and return the existing indication.

## 5. Requester Dashboard

`GET /api/dashboard/requester`

Allowed role: Requester.

Response `200`:

```json
{
  "metrics": {
    "openTickets": 3,
    "waitingForRequester": 1,
    "recentlyUpdated": 2,
    "recentlyResolved": 1
  },
  "attentionTickets": [
    {
      "ticketNumber": "TKT-20260927-0001",
      "summary": "Campus Wi-Fi issue",
      "status": "WAITING_FOR_REQUESTER",
      "updatedAt": "2026-09-27T08:31:00.000Z",
      "drillDown": { "type": "ticket", "ticketNumber": "TKT-20260927-0001" }
    }
  ],
  "recentTickets": []
}
```

All queries use the authenticated Requester ID. Zero-data responses return zero metrics and empty arrays with HTTP 200.

## 6. IT Staff Dashboard

`GET /api/dashboard/staff`

Allowed roles: IT Staff and Administrator.

Response `200`:

```json
{
  "metrics": {
    "unassignedTickets": 2,
    "myTickets": 4,
    "myActionsTaken": 6,
    "byStatus": { "NEW": 2, "OPEN": 3, "IN_PROGRESS": 4 },
    "byItPriority": { "LOW": 1, "MEDIUM": 3, "HIGH": 4, "CRITICAL": 1 }
  },
  "urgentTickets": [
    {
      "ticketNumber": "TKT-20260927-0002",
      "summary": "Core switch unavailable",
      "status": "IN_PROGRESS",
      "itPriority": "CRITICAL",
      "updatedAt": "2026-09-27T08:45:00.000Z",
      "drillDown": { "type": "staff-ticket", "ticketNumber": "TKT-20260927-0002" }
    }
  ]
}
```

Administrators receive the same operational data scope as Staff. A Requester receives `403 FORBIDDEN` and no metric data.

## 7. Existing API Compatibility

The following approved APIs continue to work without breaking their existing response contracts:

- `/api/auth/*`
- `/api/categories`
- `/api/related-systems`
- `/api/tickets`
- `/api/tickets/:ticketNumber`
- Existing attachment, Public Comment, Internal Note, Staff Queue, Staff Ticket Detail, and Administrator endpoints.

Lab 4 extends Staff Ticket Detail data with Actions Taken and adds dashboard endpoints. It does not replace existing authentication or ownership checks.
