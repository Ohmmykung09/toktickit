# Lab 4 Specification: Actions Taken, Workflow, and Dashboards

## 1. Sprint Goal

Lab 4 completes the TokTickIT service-desk workflow. IT Staff and Administrators can record the work performed on a Ticket, the backend enforces the final lifecycle rules, and Requester and IT Staff dashboards summarize authoritative operational data. The increment preserves Labs 1 to 3, remains role-safe, and is ready for final regression and demonstration.

## 2. Stakeholder Request

TokTickIT can receive Tickets and communicate with Requesters, but the service desk needs a reliable record of the work performed and a concise way to see operational priorities. Each Ticket must contain zero or more Actions Taken. Staff must be able to review and update the formal Ticket workflow, while Requesters can only provide an advisory resolution indication. Each role receives a dashboard that summarizes only the data it is allowed to see.

## 3. Scope

### Included

- Actions Taken as a parent-child work record under a Ticket.
- IT Staff and Administrator create and update permissions for Actions Taken.
- Requester read-only visibility for Actions Taken on owned Tickets.
- Final Ticket status-transition and resolution rules.
- Requester and IT Staff dashboard APIs with concise metrics and drill-down data.
- Staff Ticket Detail Actions Taken list, create mode, and edit mode.
- Role-appropriate dashboard navigation and responsive Zen Green UI.
- Unit, API, integration, UI, authorization, workflow, migration, regression, accessibility, and E2E tests.
- Final Lab 4 evidence, peer review, and staged release verification.

### Excluded

- Automatic SLA clocks, escalation engines, on-call scheduling, and breach notifications.
- Email, SMS, LINE, push, or other external notification services.
- Inventory, spare parts, purchasing, cost accounting, payroll, or time-sheet billing.
- Multi-level approvals, electronic signatures, custom report builders, and data warehouses.
- Multi-tenant organizations, cloud infrastructure, and production deployment.
- New features that are not represented by an approved Lab 4 requirement or acceptance criterion.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | The system shall store zero or more Actions Taken under each Ticket. |
| FR-02 | An Action Taken shall contain action date/time, description, result, lifecycle status, optional active assignee, immutable creator audit, authenticated performer audit, follow-up flag, conditional follow-up note, and attachment notes. |
| FR-03 | IT Staff and Administrators shall be able to list, create, assign, transition, complete, cancel, and update Actions Taken on accessible Tickets. |
| FR-04 | Requesters shall be able to read Actions Taken for owned Tickets but shall not create or update them. |
| FR-05 | The backend shall derive the performer from the authenticated session and shall ignore client-supplied actor identity. |
| FR-06 | The backend shall validate all Action Taken fields and shall require a follow-up note when follow-up is required. |
| FR-07 | The application shall preserve the final eight-status Ticket lifecycle from Labs 2 and 3. |
| FR-08 | The backend shall enforce the approved Ticket and Action Taken transition matrices, active-owner/assignee requirements, resolution gate, and stale-update protection. |
| FR-09 | A Requester resolution indication shall remain advisory and shall not directly change the formal Ticket status. |
| FR-10 | The Requester Dashboard shall show exact owned-ticket counts, a bounded recently-updated list, attention-required Tickets, and a seven-day recently-resolved count with an exact drill-down filter. |
| FR-11 | The IT Staff Dashboard shall show exact unassigned, current-user ownership, current-user Actions Taken, operational status, priority counts, and a bounded recent-or-urgent Ticket list. |
| FR-12 | Dashboard metrics shall be calculated by the backend from authoritative PostgreSQL data. |
| FR-13 | Dashboard cards and actionable rows shall provide practical drill-down destinations to detailed views or filtered queues. |
| FR-14 | Dashboards shall provide loading, empty, forbidden, and safe-failure states. |
| FR-15 | Earlier authentication, ownership, comments, notes, attachments, queue, user-management, and requester behavior shall remain available to permitted roles. |
| FR-16 | The UI shall preserve Zen Green conventions, semantic labels, visible focus, keyboard operation, and responsive behavior. |
| FR-17 | Recoverable failures shall preserve important form input and prevent duplicate submissions. |
| FR-18 | The final repository shall contain traceable documentation, tests, reviewer evidence, AI reflection, and release evidence. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | Each Action Taken belongs to exactly one Ticket and cannot be moved to another Ticket after creation. |
| BR-02 | A Ticket may have many Actions Taken. Action order is oldest-first by action date/time and ID for ties. |
| BR-03 | The Ticket Owner coordinates the Ticket as a whole. An Action Taken has a separate optional `assigneeId`; another permitted staff member may perform and record it. |
| BR-04 | Only active IT Staff and Administrators may create or update Actions Taken. |
| BR-05 | Requesters can read Actions Taken only for Tickets they own. Cross-owner resources use the same safe not-found behavior as missing resources. |
| BR-06 | `createdById` is the immutable authenticated creator audit, `performedById` is the authenticated staff actor who records the action, and neither can be supplied or changed by the client. `assigneeId` is the only assignable actor field. |
| BR-07 | Action date/time is required, stored in UTC, and may not be more than five minutes in the future. Historical dates are allowed for data entry. |
| BR-08 | Action Description is trimmed and contains 1 to 5,000 Unicode code points. |
| BR-09 | Result is trimmed and contains 1 to 2,000 Unicode code points. |
| BR-10 | Follow-up Note is null when Follow-Up Required is false and is required with 1 to 2,000 Unicode code points when it is true. |
| BR-11 | Attachment Notes are optional and contain at most 2,000 Unicode code points. They describe evidence to look for; they do not upload a file. |
| BR-12 | Action Taken updates use an integer `version` compare-and-swap value and return `409 STALE_WRITE` without partial changes when the value is stale. |
| BR-13 | Action Taken status is one of `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `COMPLETED`, or `CANCELLED`; `COMPLETED` and `CANCELLED` are terminal. |
| BR-14 | Action transitions are `OPEN -> IN_PROGRESS, WAITING_FOR_REQUESTER, COMPLETED, CANCELLED`; `IN_PROGRESS -> WAITING_FOR_REQUESTER, COMPLETED, CANCELLED`; `WAITING_FOR_REQUESTER -> IN_PROGRESS, COMPLETED, CANCELLED`; terminal states have no next state. |
| BR-15 | Assigning an Action Taken or entering `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `COMPLETED` requires an active `IT_STAFF` or `ADMINISTRATOR` assignee. An inactive, requester, or missing assignee returns `409 INACTIVE_ASSIGNEE` or `409 ASSIGNEE_REQUIRED`. |
| BR-16 | Entering `COMPLETED` sets server `completedAt`; entering `CANCELLED` sets server `cancelledAt`; these timestamps are immutable and mutually exclusive. |
| BR-17 | Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`. |
| BR-18 | Only transitions in the approved Ticket matrix are accepted by the backend. UI controls are guidance, not authorization. |
| BR-19 | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, and `REOPENED` require an active Ticket Owner. |
| BR-20 | `CLOSED` is allowed only from `RESOLVED`; `CANCELLED` is terminal; `REOPENED` increments the Ticket `resolutionCycle`, clears the current `resolvedAt`, and preserves earlier history. |
| BR-21 | A transition to `RESOLVED` requires, in the same serializable transaction as the status update, an active owner and at least one Action Taken for the current `resolutionCycle` with `status=COMPLETED`, non-empty trimmed `result`, and non-null `completedAt`. The check is repeated after the row lock and cannot be bypassed by a direct API call. |
| BR-22 | A Requester Problem Appears Resolved action records the authenticated Requester and UTC timestamp but does not change formal status. |
| BR-23 | Dashboard calculations use one captured server clock and closed UTC windows: `windowStart <= timestamp <= now`. Seven-day metrics use `resolvedAt` for the current resolved cycle, not a later generic `updatedAt`. |
| BR-24 | Requester metrics and lists are filtered by the authenticated Requester ID in the backend. |
| BR-25 | Staff metrics include all operational Tickets visible to IT Staff and Administrators and never expose password, session, or storage-secret fields. |
| BR-26 | Empty dashboard datasets return zero counts and empty arrays with HTTP 200, not errors. |
| BR-27 | Dashboard responses contain concise metrics and bounded lists with stable ordering and drill-down references, not full Ticket collections. |
| BR-28 | All mutations require the existing authenticated session, approved Origin, and session CSRF token. |
| BR-29 | Existing Lab 1 to Lab 3 records remain valid after the Lab 4 migration; migration and seed operations are repeat-safe and preserve user-managed values. |
| BR-30 | Actions Taken cannot be deleted, re-parented, or silently removed from Ticket history. Non-terminal edits preserve immutable `createdAt` and `createdById`; terminal Actions are immutable. Ticket transitions preserve all prior Actions and status history. |

## 6. Authorization Matrix

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Read Actions Taken for an owned Ticket | Allow | Allow | Allow |
| Create, assign, transition, or update Actions Taken | Deny | Allow | Allow |
| Change formal Ticket status | Deny | Allow | Allow |
| Indicate Problem Appears Resolved | Own Tickets | Deny | Deny |
| Read Requester Dashboard | Own data | Deny | Deny |
| Read IT Staff Dashboard | Deny | Allow | Allow |
| Open Staff Ticket Detail | Deny | Allow | Allow |
| Use earlier Lab 2 and Lab 3 features | Own/role scope | Role scope | Role scope |

Every denial is enforced by the backend even when a client constructs the request manually.

## 7. Ticket Status Transition Matrix

| Current status | Permitted next status | Additional rule |
| --- | --- | --- |
| `NEW` | `OPEN`, `IN_PROGRESS`, `CANCELLED` | `IN_PROGRESS` requires an owner. |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Operational states require an owner. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Requires an owner. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | Requires an owner. |
| `RESOLVED` | `CLOSED`, `REOPENED` | Closing requires the Ticket to already be Resolved. |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Requires an owner. |
| `CLOSED` | `REOPENED` | Reopening preserves history and requires an owner. |
| `CANCELLED` | None | Terminal in Lab 4. |

Formal status changes are performed only by IT Staff or Administrators. Requester indication is evidence for staff review and is never a direct status mutation.

### Action Taken lifecycle

| Current status | Permitted next status | Additional rule |
| --- | --- | --- |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `COMPLETED`, `CANCELLED` | Assignment is optional only while `OPEN`. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `COMPLETED`, `CANCELLED` | Requires an active assignee. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | Requires an active assignee. |
| `COMPLETED` | None | `completedAt` is immutable. |
| `CANCELLED` | None | `cancelledAt` is immutable. |

Creating an Action Taken starts it as `OPEN` and records `createdById` and `performedById` from the authenticated staff session. Assignment and later transitions may be performed by any authorized staff member, but the backend validates the assignee's current active role inside the same transaction. Every mutation supplies `expectedVersion`; a successful mutation increments `version` exactly once.

## 8. Dashboard Calculations

| Dashboard | Metric | Calculation and drill-down |
| --- | --- | --- |
| Requester | Open Tickets | Count owned Tickets in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; drill-down is `My Tickets?status=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`. |
| Requester | Waiting for Requester | Count owned Tickets in `WAITING_FOR_REQUESTER`; drill-down is `My Tickets?status=WAITING_FOR_REQUESTER`. |
| Requester | Recently Updated | `recentlyUpdatedCount` counts owned Tickets with `now-7d <= updatedAt <= now`; `recentTickets` contains at most five with `updatedAt DESC, id DESC`; each row opens Ticket Detail. |
| Requester | Recently Resolved | `recentlyResolvedCount` counts owned Tickets with status `RESOLVED` or `CLOSED` and `now-7d <= resolvedAt <= now`; drill-down is `My Tickets?status=RESOLVED,CLOSED&resolvedSince=7d`. |
| IT Staff | Unassigned | Count operational Tickets with `ownerId IS NULL`; drill-down is Queue `owner=unassigned`. |
| IT Staff | My Tickets | Count operational Tickets owned by the authenticated Staff user; drill-down is Queue `owner=me`. |
| IT Staff | Current-user Actions | Count Actions with `performedById=currentUser` and `now-7d <= actionDateTime <= now`; drill-down is Queue `performedBy=me&actionSince=7d`. |
| IT Staff | By Status | Counts operational Tickets for exactly `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`; each value opens its Queue status filter. |
| IT Staff | By IT Priority | Counts operational Tickets for `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`; each value opens its Queue priority filter. |
| IT Staff | Recent or Urgent | `urgentTickets` contains at most five operational Tickets where `itPriority=CRITICAL` or `updatedAt >= now-2d`, ordered `CRITICAL first, updatedAt DESC, id DESC`; each row opens Staff Ticket Detail. |

The Requester attention list contains at most 20 `WAITING_FOR_REQUESTER` Tickets ordered `updatedAt DESC, id DESC`. The Staff dashboard exposes `operationalTickets` as the sum of the five status buckets above. All dashboard windows are evaluated once using one server `now` value so counts and lists cannot straddle a boundary.

## 9. Data and Migration Decisions

### Action Taken model and design decisions

`ActionTaken` contains `id`, `ticketId`, `actionDateTime`, `description`, `result`, `status`, `resolutionCycle`, `assigneeId`, `createdById`, `performedById`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `completedAt`, `cancelledAt`, `version`, nullable `fixtureKey`, `createdAt`, and `updatedAt`. `Ticket` contains `resolutionCycle` (default `1`) and nullable `resolvedAt`. `Ticket` has many Actions Taken; `User` has creator, performer, and assignee relations.

1. A surrogate `id` is retained for stable URLs and tie-breaking. `fixtureKey` is nullable and unique for deterministic Lab 4 seed rows; normal user-created rows remain null. This avoids treating mutable descriptions or timestamps as identity while allowing repeat-safe fixtures.
2. The read path uses `(ticketId, actionDateTime, id)` for the oldest-first detail list, `(ticketId, resolutionCycle, status, completedAt)` for the resolution gate, `(assigneeId, status, updatedAt)` for assignment work, and `(performedById, actionDateTime)` for the staff dashboard. These indexes add write cost but prevent unbounded scans for the required queries.
3. Action mutations use integer `version` compare-and-swap rather than timestamp equality. The Ticket status change and qualifying Action lookup run under one serializable transaction after locking the Ticket row; reopening increments `resolutionCycle` and clears `resolvedAt`, preventing a completed Action from an earlier cycle from satisfying a later resolution.
4. The migration is additive: no Action rows are backfilled, existing Tickets receive `resolutionCycle=1` and `resolvedAt=NULL`, and all earlier Users, Tickets, Attachments, Public Comments, Internal Notes, ticket numbers, and timestamps are preserved. Existing Tickets therefore remain valid with zero Actions Taken.

### Migration, seed, and recovery procedure

Before applying the migration, CI/operator checks the target PostgreSQL version, confirms schema drift is absent, verifies free storage, captures row counts and relationship counts for Users, Tickets, Attachments, Public Comments, and Internal Notes, and takes a restorable database backup. The migration runs in a transaction; the preflight and postflight counts are recorded as evidence.

If any DDL or postflight check fails, the transaction is rolled back and the previous schema remains active. If a failure occurs after the transaction is committed or outside transactional DDL, recovery is a tested restore rehearsal from the preflight backup followed by a forward migration. There is no unreviewed destructive down migration. `MIG-03` forces a failure between migration steps on a disposable database and verifies no partial schema or data remains; `MIG-04` rehearses backup restore.

The seed uses only stable `fixtureKey` values, upserts missing fixtures, and never overwrites a row whose `fixtureKey` exists with user-managed edits. It creates realistic deterministic Tickets covering every major Ticket status, every IT Priority, assigned and unassigned ownership, and zero-, one-, and multiple-Action cases. It also includes data that produces both non-zero and zero dashboard metrics. The seed preserves existing records and is run twice in `MIG-05`; the second run produces no duplicate rows and no changes to user-managed values. Legacy Lab 3 pages and queue/My Tickets queries continue to use their existing filters and records; a dashboard with no Lab 4 data returns zero/empty values rather than changing legacy behavior.

## 10. Acceptance Criteria

| ID | Observable criterion |
| --- | --- |
| AC-01 | A permitted Staff user can create an Action Taken under the correct Ticket and the backend records the authenticated performer. |
| AC-02 | A permitted Staff user can update an Action Taken with valid data and a current concurrency value. |
| AC-03 | Requesters can read Actions Taken for owned Tickets but cannot create or update them, including through direct API calls. |
| AC-04 | Invalid fields, future dates, missing conditional follow-up notes, and oversized text return safe validation errors. |
| AC-05 | Stale Action Taken and Ticket updates return `409 STALE_WRITE` without overwriting newer data. |
| AC-06 | Only the approved Ticket and Action Taken transitions succeed; active owner/assignee requirements, Action completion/cancellation timestamps, and the current-cycle Completed Action resolution gate are enforced atomically by the backend. |
| AC-07 | Requester resolution indication remains advisory and does not change formal Ticket status. |
| AC-08 | Requester Dashboard metrics and recent Tickets contain only the authenticated Requester's data and match authoritative queries. |
| AC-09 | IT Staff Dashboard metrics and the bounded recent-or-urgent list match authoritative queries, fixed UTC windows, stable ordering, and exact drill-down filters for unassigned, owned, status, priority, and current-user Actions Taken. |
| AC-10 | Dashboard cards and actionable items drill down to the appropriate detailed or filtered view. |
| AC-11 | Dashboard loading, empty, forbidden, not-found, conflict, and safe-failure states are clear and recoverable. |
| AC-12 | Staff Ticket Detail supports Actions Taken list, create, edit, read-only requester visibility, and conditional follow-up validation. |
| AC-13 | All prior authentication, authorization, requester, queue, comments, notes, attachments, and user-management regression tests pass; populated-data migration preserves row and relationship counts. |
| AC-14 | Required desktop, tablet, and mobile views have no clipping, overlap, inaccessible control, or page-level horizontal overflow. |
| AC-15 | Keyboard focus, semantic labels, non-color status cues, and accessible error placement are verified. |
| AC-16 | The final integrated branch passes unit, API, integration, UI, migration, rollback/recovery, repeat-seed, performance-smoke, E2E, build, accessibility, and responsive checks. |

## 11. Definition of Done

- All FR, BR, and AC items are implemented or explicitly excluded by this contract.
- `docs/lab-04/specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are reviewed before implementation PRs are completed.
- Actions Taken, workflow, and dashboard API contracts match the implementation and tests.
- Backend authorization is enforced independently from UI visibility.
- Existing Lab 1 to Lab 3 behavior remains valid after migration.
- All planned tests are automated where practical and their final status is recorded.
- Staff and Requester dashboards have accurate metrics, drill-down, and safe states.
- Zen Green desktop, tablet, mobile, keyboard, and overflow checks pass.
- README setup, seed, migration, test, and demonstration instructions are current.
- Reviewer identity, PR comments, responses, approvals, AI reflection, and final evidence are recorded before release.
- `docs/lab-04/reviewer.md` records reviewer identity, PR links, comments, responses, and approvals; `docs/lab-04/ai-use.md` records the LLM, selected prompts, and reflection before release.
- The final submission is one concise PDF with working links and headings `Answer Part 1` through `Answer Part 9` in the required order.
- The release PR enters `main` only from reviewed `lab4-staging`.

## 12. Assumptions and Decisions

- All date/time values are stored as UTC and rendered in the user's browser locale.
- A Ticket Owner coordinates a Ticket but does not need to perform every Action Taken.
- Dashboard time windows are fixed by this contract so tests are deterministic.
- Administrators reuse the IT Staff dashboard and API permissions unless a later approved requirement states otherwise.
- Attachment Notes are descriptive text and are separate from the existing Attachment upload feature.
