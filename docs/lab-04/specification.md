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
| FR-02 | An Action Taken shall contain action date/time, description, result, authenticated performer, follow-up flag, conditional follow-up note, and attachment notes. |
| FR-03 | IT Staff and Administrators shall be able to list, create, and update Actions Taken on accessible Tickets. |
| FR-04 | Requesters shall be able to read Actions Taken for owned Tickets but shall not create or update them. |
| FR-05 | The backend shall derive the performer from the authenticated session and shall ignore client-supplied actor identity. |
| FR-06 | The backend shall validate all Action Taken fields and shall require a follow-up note when follow-up is required. |
| FR-07 | The application shall preserve the final eight-status Ticket lifecycle from Labs 2 and 3. |
| FR-08 | The backend shall enforce the approved status-transition matrix, owner requirements, and stale-update protection. |
| FR-09 | A Requester resolution indication shall remain advisory and shall not directly change the formal Ticket status. |
| FR-10 | The Requester Dashboard shall show owned-ticket metrics, attention-required Tickets, recently updated Tickets, and recently resolved Tickets. |
| FR-11 | The IT Staff Dashboard shall show unassigned Tickets, current-user ownership, status and priority counts, current-user Actions Taken, and recent or urgent Tickets. |
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
| BR-03 | The Ticket Owner coordinates the Ticket as a whole, but another permitted IT Staff member may perform and record an Action Taken. |
| BR-04 | Only active IT Staff and Administrators may create or update Actions Taken. |
| BR-05 | Requesters can read Actions Taken only for Tickets they own. Cross-owner resources use the same safe not-found behavior as missing resources. |
| BR-06 | Performed By is always the authenticated actor and cannot be supplied, changed, or impersonated by the client. |
| BR-07 | Action date/time is required, stored in UTC, and may not be more than five minutes in the future. Historical dates are allowed for data entry. |
| BR-08 | Action Description is trimmed and contains 1 to 5,000 Unicode code points. |
| BR-09 | Result is trimmed and contains 1 to 2,000 Unicode code points. |
| BR-10 | Follow-up Note is null when Follow-Up Required is false and is required with 1 to 2,000 Unicode code points when it is true. |
| BR-11 | Attachment Notes are optional and contain at most 2,000 Unicode code points. They describe evidence to look for; they do not upload a file. |
| BR-12 | Actions Taken updates use optimistic concurrency through the current `updatedAt` value and return `409 STALE_WRITE` for stale data. |
| BR-13 | Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`. |
| BR-14 | Only transitions in the approved matrix are accepted by the backend. UI controls are guidance, not authorization. |
| BR-15 | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, and `REOPENED` require an active Ticket Owner. |
| BR-16 | `CLOSED` is allowed only from `RESOLVED`; `CANCELLED` is terminal in this sprint; `REOPENED` preserves the existing history. |
| BR-17 | A Requester Problem Appears Resolved action records the authenticated Requester and UTC timestamp but does not change formal status. |
| BR-18 | Dashboard calculations use UTC date boundaries and the server clock. Recent means the previous seven UTC days unless a metric explicitly states another period. |
| BR-19 | Requester metrics and lists are filtered by the authenticated Requester ID in the backend. |
| BR-20 | Staff metrics include all operational Tickets visible to IT Staff and Administrators and never expose password, session, or storage-secret fields. |
| BR-21 | Empty dashboard datasets return zero counts and empty arrays with HTTP 200, not errors. |
| BR-22 | Dashboard responses contain concise metrics and drill-down references, not full Ticket collections. |
| BR-23 | All mutations require the existing authenticated session, approved Origin, and session CSRF token. |
| BR-24 | Existing Lab 1 to Lab 3 records remain valid after the Lab 4 migration; migration and seed operations are repeat-safe. |

## 6. Authorization Matrix

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Read Actions Taken for an owned Ticket | Allow | Allow | Allow |
| Create or update Actions Taken | Deny | Allow | Allow |
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

## 8. Dashboard Calculations

| Dashboard | Metric | Calculation and drill-down |
| --- | --- | --- |
| Requester | Open Tickets | Count owned Tickets in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; opens My Tickets with an open-status filter. |
| Requester | Waiting for Requester | Count owned Tickets in `WAITING_FOR_REQUESTER`; opens the filtered Ticket list. |
| Requester | Recently Updated | Up to five owned Tickets ordered by `updatedAt DESC, id DESC` within seven UTC days; opens Ticket Detail. |
| Requester | Recently Resolved | Count or list owned Tickets in `RESOLVED` or `CLOSED` updated within seven UTC days; opens the filtered Ticket list. |
| IT Staff | Unassigned | Count Tickets with `ownerId IS NULL` and non-terminal status; opens the Queue with unassigned filter. |
| IT Staff | My Tickets | Count non-terminal Tickets owned by the authenticated Staff user; opens Queue with `owner=me`. |
| IT Staff | Current-user Actions | Count Actions Taken performed by the authenticated Staff user within seven UTC days; opens the related Ticket list. |
| IT Staff | By Status | Count operational Tickets grouped by status; each value opens a Queue status filter. |
| IT Staff | By IT Priority | Count operational Tickets grouped by IT Priority; each value opens a Queue priority filter. |
| IT Staff | Recent or Urgent | Up to five Tickets with `CRITICAL` IT Priority or updated within two UTC days, ordered deterministically; opens Ticket Detail. |

## 9. Data and Migration Decisions

### Action Taken model

The new `ActionTaken` model contains `id`, `ticketId`, `actionDateTime`, `description`, `result`, `performedById`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `createdAt`, and `updatedAt`. `Ticket` has many Actions Taken. `User` has a relation for performed Actions Taken. Indexes support `(ticketId, actionDateTime, id)` and `(performedById, actionDateTime)`.

The migration is additive and must not delete or rewrite earlier Users, Tickets, Attachments, Public Comments, Internal Notes, ticket numbers, or timestamps. Existing Tickets have zero Actions Taken and remain valid. The seed adds deterministic examples covering zero, one, and multiple Actions Taken without resetting user-managed fields.

### Concurrency and recovery

Create and update operations use the authenticated actor and current `updatedAt`. A stale write returns a safe conflict response. The UI reloads authoritative Ticket data after a conflict and preserves unsent form input after recoverable failures.

## 10. Acceptance Criteria

| ID | Observable criterion |
| --- | --- |
| AC-01 | A permitted Staff user can create an Action Taken under the correct Ticket and the backend records the authenticated performer. |
| AC-02 | A permitted Staff user can update an Action Taken with valid data and a current concurrency value. |
| AC-03 | Requesters can read Actions Taken for owned Tickets but cannot create or update them, including through direct API calls. |
| AC-04 | Invalid fields, future dates, missing conditional follow-up notes, and oversized text return safe validation errors. |
| AC-05 | Stale Action Taken and Ticket updates return `409 STALE_WRITE` without overwriting newer data. |
| AC-06 | Only the approved Ticket transitions succeed; owner requirements and the Resolved-to-Closed gate are enforced by the backend. |
| AC-07 | Requester resolution indication remains advisory and does not change formal Ticket status. |
| AC-08 | Requester Dashboard metrics and recent Tickets contain only the authenticated Requester's data and match authoritative queries. |
| AC-09 | IT Staff Dashboard metrics match authoritative queries for unassigned, owned, status, priority, current-user Actions Taken, and recent/urgent Tickets. |
| AC-10 | Dashboard cards and actionable items drill down to the appropriate detailed or filtered view. |
| AC-11 | Dashboard loading, empty, forbidden, not-found, conflict, and safe-failure states are clear and recoverable. |
| AC-12 | Staff Ticket Detail supports Actions Taken list, create, edit, read-only requester visibility, and conditional follow-up validation. |
| AC-13 | All prior authentication, authorization, requester, queue, comments, notes, attachments, and user-management regression tests pass. |
| AC-14 | Required desktop, tablet, and mobile views have no clipping, overlap, inaccessible control, or page-level horizontal overflow. |
| AC-15 | Keyboard focus, semantic labels, non-color status cues, and accessible error placement are verified. |
| AC-16 | The final integrated branch passes unit, API, integration, UI, migration, E2E, build, accessibility, and responsive checks. |

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
- The release PR enters `main` only from reviewed `lab4-staging`.

## 12. Assumptions and Decisions

- All date/time values are stored as UTC and rendered in the user's browser locale.
- A Ticket Owner coordinates a Ticket but does not need to perform every Action Taken.
- Dashboard time windows are fixed by this contract so tests are deterministic.
- Administrators reuse the IT Staff dashboard and API permissions unless a later approved requirement states otherwise.
- Attachment Notes are descriptive text and are separate from the existing Attachment upload feature.
