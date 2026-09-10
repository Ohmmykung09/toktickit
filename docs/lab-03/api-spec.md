# Lab 3 API Specification

## 1. Conventions

- Local base URL: `http://localhost:3000`.
- JSON is used except attachment upload/download.
- Protected requests use an opaque server-side session cookie named `toktickit_session`.
- The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, and `Secure` outside local development.
- Frontend requests use `credentials: "include"`. The Lab 2 `X-Development-Requester-Id` header is removed.
- State-changing requests require `X-CSRF-Token` matching the authenticated session and an approved `Origin`.
- Date/time values use UTC ISO 8601. Enum values use uppercase snake case in API payloads.
- Public response objects are explicitly mapped; Prisma records are never returned directly.

## 2. Authentication Contract

### POST /api/auth/login

Public. Accepts `{ "email": string, "password": string }`.

- Password inputs contain 12 to 128 characters and at least three of the uppercase, lowercase, digit, and symbol classes. Stored hashes use the Argon2id parameters in `specification.md`.
- `200 OK`: sets the session cookie and returns `{ "user": PublicUser, "mustChangePassword": boolean, "csrfToken": string }`.
- `400 VALIDATION_ERROR`: malformed body or field bounds.
- `401 INVALID_CREDENTIALS`: wrong, inactive, unknown, or temporarily blocked account using the same safe message.
- `429 TOO_MANY_ATTEMPTS`: optional `Retry-After`; message remains account-neutral.

### GET /api/auth/me

Returns `{ "user": PublicUser, "mustChangePassword": boolean, "csrfToken": string }` for a valid session. Returns `401 UNAUTHENTICATED` for a missing, expired, revoked, or malformed session.

### POST /api/auth/change-password

Requires a valid session and CSRF token. Accepts `{ "currentPassword": string, "newPassword": string }`.

- `200 OK`: saves the new hash, clears `mustChangePassword`, revokes all previous sessions, creates/returns a replacement session, and returns safe current-user data.
- `400 VALIDATION_ERROR`: policy, equality, or shape failure.
- `401 INVALID_CREDENTIALS`: current password mismatch.

### POST /api/auth/logout

Requires the session cookie and CSRF token. Revokes the session, clears the cookie, and returns `204 No Content`. Repeated logout is safe and does not disclose session state.

### PublicUser

```json
{ "id": 21, "name": "Narin S.", "email": "narin@example.test", "role": "IT_STAFF" }
```

Password hashes, counters, lock state, session version, and tokens are never returned.

## 3. Authorization Rules

- Authentication middleware resolves the session and attaches an allowlisted user identity.
- Forced-password-change middleware permits only `/api/auth/me`, `/api/auth/change-password`, and `/api/auth/logout`.
- Role middleware applies the matrix in `specification.md`.
- Requester ticket/attachment/comment queries include authenticated requester ownership in the database query.
- Missing and cross-owner Requester resources return the same `404 RESOURCE_NOT_FOUND` shape.
- Requesters receive `403 FORBIDDEN` for staff/admin collections and Internal Note endpoints without note content.

## 4. Requester APIs

Existing Lab 2 paths remain, but requester identity comes only from the session:

- `GET /api/categories`
- `GET /api/related-systems`
- `POST /api/tickets`
- `GET /api/tickets`
- `GET /api/tickets/:ticketNumber`
- `GET/POST /api/tickets/:ticketNumber/attachments`
- `GET /api/tickets/:ticketNumber/attachments/:attachmentId/download`
- `DELETE /api/tickets/:ticketNumber/attachments/:attachmentId`

The `X-Development-Requester-Id` header is ignored or rejected. Ticket creation idempotency is scoped to the authenticated User ID.

### GET/POST /api/tickets/:ticketNumber/public-comments

Requester access is limited to an owned ticket. IT Staff and Administrators may use the same endpoint for any accessible ticket. GET returns oldest-first Public Comments. POST accepts `{ "content": string }`, derives author/time from the backend, and returns `201 Created`.

### POST /api/tickets/:ticketNumber/problem-appears-resolved

Requester-only, owned ticket. Records requester identity and backend timestamp without changing Ticket status. First success returns `200 OK`; an identical repeat returns the same indication.

## 5. IT Staff APIs

These endpoints allow `IT_STAFF` and `ADMINISTRATOR`.

### GET /api/staff/tickets

Query parameters:

| Parameter | Contract |
| --- | --- |
| `search` | Trimmed, maximum 100 characters; searches Ticket Number, Summary, Description, and Requester name/email. |
| `categoryId` / `relatedSystemId` | Positive PostgreSQL `Int` identifiers. |
| `status` | One required Ticket status when present. |
| `requestedPriority` / `itPriority` | One priority enum when present. |
| `owner` | `unassigned`, `me`, or an active permitted owner ID. |
| `sortBy` | `createdAt`, `updatedAt`, `ticketNumber`, `requestedPriority`, `itPriority`, or `status`. |
| `sortOrder` | `asc` or `desc`; default `desc`. |
| `page` / `pageSize` | 1-based page; size is 10, 20, or 50. |

Returns `{ items, filters, pagination }` with deterministic ID tie-breaking. Unknown, repeated, empty-present, or invalid parameters return `400 INVALID_QUERY`.

### GET /api/staff/tickets/:ticketNumber

Returns allowlisted ticket, requester, owner, priorities, status, resolution indication, attachments, Public Comments, and Internal Notes. Internal storage fields and credentials are excluded.

### GET /api/staff/assignees

Returns active `IT_STAFF` and `ADMINISTRATOR` users as `{ id, name, role }`, ordered by name then ID.

### PATCH /api/staff/tickets/:ticketNumber/assignment

Accepts `{ "ownerId": number | null, "expectedUpdatedAt": string }`. `ownerId: null` unassigns. Claim is represented by the acting user's ID. Returns the updated public operational ticket. Invalid/inactive target returns `400`; stale data returns `409`.

### PATCH /api/staff/tickets/:ticketNumber/it-priority

Accepts `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", "expectedUpdatedAt": string }`. Requested Priority is never changed.

### PATCH /api/staff/tickets/:ticketNumber/status

Accepts `{ "status": TicketStatus, "expectedUpdatedAt": string }`. The backend validates the transition matrix and owner requirement. Invalid transition returns `409 INVALID_STATUS_TRANSITION`.

### GET/POST /api/staff/tickets/:ticketNumber/internal-notes

GET returns oldest-first notes. POST accepts `{ "content": string }`, derives author/time, and returns `201 Created`. Requester access returns `403` without note metadata.

## 6. Administrator APIs

All endpoints require `ADMINISTRATOR`.

### GET /api/admin/users

Supports optional `search` by normalized name/email and one `role` filter. No pagination is required. Returns allowlisted `{ id, name, email, role, isActive, mustChangePassword, createdAt, updatedAt }` records.

### POST /api/admin/users

Accepts `{ "name", "email", "role", "isActive", "initialPassword" }`. Creates one role, stores only the hash, sets `mustChangePassword = true`, and returns `201 Created`. Duplicate normalized email returns `409 EMAIL_ALREADY_EXISTS`.

### PATCH /api/admin/users/:userId

Accepts any allowlisted subset of `{ "name", "email", "role", "isActive" }`. Self-deactivation and deactivating/demoting the last active Administrator return `409 ADMIN_SAFETY_RULE`. Deactivation revokes sessions atomically.

### POST /api/admin/users/:userId/initial-password

Accepts `{ "initialPassword": string }`. Saves the hash, sets mandatory change, revokes target sessions, and returns `204 No Content` without returning the password.

## 7. Safe Error Contract

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fieldErrors": { "email": "Enter a valid email address." }
  }
}
```

| HTTP status | Code | Use |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_QUERY`, `INVALID_TICKET_NUMBER` | Invalid shape, fields, query, or identifier. |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Missing/invalid session or safe login failure. |
| 403 | `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED` | Authenticated but not permitted. |
| 404 | `RESOURCE_NOT_FOUND` | Missing or ownership-hidden resource. |
| 409 | `CONFLICT`, `EMAIL_ALREADY_EXISTS`, `INVALID_STATUS_TRANSITION`, `ADMIN_SAFETY_RULE` | State conflict. |
| 413 | `PAYLOAD_TOO_LARGE` | Body or attachment exceeds limits. |
| 429 | `TOO_MANY_ATTEMPTS` | Login attempt limit. |
| 500 | `INTERNAL_ERROR` | Unexpected safe failure with server-side logging only. |

`fieldErrors` is optional and contains only known public fields with non-empty strings. Error responses never contain stack traces, Prisma details, hashes, tokens, paths, or another user's protected data.

## 8. Session and CSRF Lifecycle

- Login creates 32 random bytes for the session token and a separate CSRF token.
- Only cryptographic hashes are stored in PostgreSQL; cookie/token comparison is constant-time where applicable.
- Session expiry is eight hours with no silent extension during Lab 3.
- Password change/reset, deactivation, and logout revoke sessions immediately.
- CORS permits only configured client origins, credentials, `Content-Type`, `Idempotency-Key`, and `X-CSRF-Token`.
- GET/HEAD/OPTIONS are read-only. POST/PATCH/DELETE require Origin and CSRF validation.
