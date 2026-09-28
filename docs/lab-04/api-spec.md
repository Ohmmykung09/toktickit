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
| `409` | Invalid workflow transition, missing/inactive owner or assignee, resolution-gate failure, or stale optimistic-concurrency value. |
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
    "status": "COMPLETED",
    "resolutionCycle": 1,
    "description": "Checked the access point and replaced the damaged cable.",
    "result": "Link restored and connectivity verified.",
    "assignee": { "id": 6, "name": "Ploy IT", "role": "IT_STAFF" },
    "createdBy": { "id": 6, "name": "Ploy IT", "role": "IT_STAFF" },
    "performedBy": {
      "id": 6,
      "name": "Ploy IT",
      "role": "IT_STAFF"
    },
    "followUpRequired": true,
    "followUpNote": "Confirm stability with the requester tomorrow.",
    "attachmentNotes": "Look for the cable replacement photo.",
    "completedAt": "2026-09-27T08:35:00.000Z",
    "cancelledAt": null,
    "version": 2,
    "createdAt": "2026-09-27T08:31:00.000Z",
    "updatedAt": "2026-09-27T08:35:00.000Z"
  }
]
```

The list is ordered by `actionDateTime ASC, id ASC`. Cross-owner Requester access returns the same `404 RESOURCE_NOT_FOUND` shape as a missing Ticket. The response includes audit identities but never password or session fields.

### Create Action Taken

`POST /api/staff/tickets/:ticketNumber/actions-taken`

Allowed roles: IT Staff and Administrator.

Request:

```json
{
  "actionDateTime": "2026-09-27T08:30:00.000Z",
  "status": "OPEN",
  "assigneeId": 6,
  "description": "Checked the access point and replaced the damaged cable.",
  "result": "Link restored and connectivity verified.",
  "followUpRequired": true,
  "followUpNote": "Confirm stability with the requester tomorrow.",
  "attachmentNotes": "Look for the cable replacement photo."
}
```

The server derives `createdBy` and `performedBy` from the authenticated session. A new Action always starts as `OPEN`; `resolutionCycle` is copied from the Ticket; `assigneeId`, when present, must reference an active IT Staff or Administrator. Client-supplied `createdBy`, `createdById`, `performedBy`, `performedById`, `ticketId`, `resolutionCycle`, timestamps, `version`, and `fixtureKey` fields are rejected or ignored and never control authorship or audit history.

Response `201`: the created Action Taken using the response shape above.

### Update Action Taken

`PATCH /api/staff/tickets/:ticketNumber/actions-taken/:actionId`

Allowed roles: IT Staff and Administrator.

Request:

```json
{
  "status": "COMPLETED",
  "assigneeId": 6,
  "actionDateTime": "2026-09-27T08:45:00.000Z",
  "description": "Checked the access point and replaced the damaged cable.",
  "result": "Verified stable connectivity from two locations.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "",
  "expectedVersion": 1
}
```

Response `200`: the authoritative updated Action Taken. Assignment and status changes use the same endpoint. `COMPLETED` requires an active assignee and non-empty `result`; the server sets `completedAt` and increments `version`. `CANCELLED` sets `cancelledAt`. A stale `expectedVersion` returns `409 STALE_WRITE` and leaves the stored record unchanged.

Allowed Action transitions are `OPEN -> IN_PROGRESS|WAITING_FOR_REQUESTER|COMPLETED|CANCELLED`, `IN_PROGRESS -> WAITING_FOR_REQUESTER|COMPLETED|CANCELLED`, and `WAITING_FOR_REQUESTER -> IN_PROGRESS|COMPLETED|CANCELLED`. Terminal Actions reject further updates with `409 ACTION_TERMINAL`. A requester or inactive assignee returns `409 INACTIVE_ASSIGNEE`; a required missing assignee returns `409 ASSIGNEE_REQUIRED`.

There is no delete or re-parent Action Taken endpoint. `ticketId`, `createdAt`, and `createdBy` remain immutable; terminal Actions reject edits. Ticket status changes never delete or rewrite existing Actions Taken or earlier workflow evidence.

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

The backend checks, in one serializable transaction and in this order:

1. The status value is a permitted enum value.
2. The current Ticket exists and is visible to the Staff role.
3. The requested transition exists in the Ticket matrix.
4. A required active owner exists.
5. For a transition to `RESOLVED`, the locked Ticket's current `resolutionCycle` has an Action Taken with `status=COMPLETED`, non-empty trimmed `result`, and non-null `completedAt`.
6. `expectedUpdatedAt` still matches the current Ticket.
7. The Ticket status, `resolvedAt`, or `resolutionCycle` is updated atomically; reopening increments `resolutionCycle` and clears `resolvedAt`.

Invalid transitions return `409 INVALID_STATUS_TRANSITION`. Missing ownership returns `409 OWNER_REQUIRED`. A failed resolution gate returns `409 RESOLUTION_ACTION_REQUIRED`. A stale value returns `409 STALE_WRITE`. A transition to the current status returns `400 VALIDATION_ERROR`. The gate is enforced here even when the UI is bypassed.

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
    "recentlyUpdatedCount": 2,
    "recentlyResolvedCount": 1
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
  "recentTickets": [
    {
      "ticketNumber": "TKT-20260927-0001",
      "summary": "Campus Wi-Fi issue",
      "status": "WAITING_FOR_REQUESTER",
      "updatedAt": "2026-09-27T08:31:00.000Z",
      "drillDown": { "type": "ticket", "ticketNumber": "TKT-20260927-0001" }
    }
  ]
}
```

`openTickets` includes exactly `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`; its drill-down is `My Tickets?status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`. `recentlyUpdatedCount` and `recentTickets` use the closed window `now-7d <= updatedAt <= now`; `recentTickets` is limited to five and ordered `updatedAt DESC, id DESC`. `recentlyResolvedCount` uses status `RESOLVED` or `CLOSED` and the authoritative current-cycle `resolvedAt` in the same window. Its drill-down is `My Tickets?status=RESOLVED,CLOSED&resolvedSince=7d`. The attention list is limited to 20 and ordered `updatedAt DESC, id DESC`. All queries use the authenticated Requester ID. Zero-data responses return zero metrics and empty arrays with HTTP 200.

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
    "operationalTickets": 9,
    "byStatus": { "NEW": 2, "OPEN": 3, "IN_PROGRESS": 2, "WAITING_FOR_REQUESTER": 1, "REOPENED": 1 },
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

`unassignedTickets`, `myTickets`, `operationalTickets`, and the status/priority buckets include only operational statuses `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`. `myActionsTaken` counts rows with `performedById=currentUser` and `now-7d <= actionDateTime <= now`. `urgentTickets` is limited to five and includes operational Tickets where `itPriority=CRITICAL` or `updatedAt >= now-2d`, ordered `CRITICAL first, updatedAt DESC, id DESC`. Drill-downs are `Queue?owner=unassigned`, `Queue?owner=me`, `Queue?performedBy=me&actionSince=7d`, and the corresponding status/priority filters. Administrators receive the same operational data scope as Staff. A Requester receives `403 FORBIDDEN` and no metric data. One server `now` is used for every field in a response.

## 7. Existing API Compatibility

The following approved APIs continue to work without breaking their existing response contracts:

- `/api/auth/*`
- `/api/categories`
- `/api/related-systems`
- `/api/tickets`
- `/api/tickets/:ticketNumber`
- Existing attachment, Public Comment, Internal Note, Staff Queue, Staff Ticket Detail, and Administrator endpoints.

Lab 4 extends Staff Ticket Detail data with Actions Taken and adds dashboard endpoints. It does not replace existing authentication or ownership checks.
