# Lab 4 Test Plan and Traceability

## 1. Test-Driven Delivery

This test plan is created before the main Lab 4 implementation. Each acceptance criterion has planned evidence across unit, API/integration, UI, migration/regression, accessibility, responsive, and E2E layers. The final status will be recorded after the reviewed integrated branch passes.

## 2. Planned Test Matrix

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-01 to BR-12 | Action Taken validation, Unicode boundaries, follow-up conditional rules, dates, and compare-and-swap version | Invalid input is rejected with field errors; valid input is normalized; stale version is rejected without mutation. | `server/tests/lab-04/actions-taken.policy.test.ts` | Planned |
| UNIT-02 | Unit | BR-13 to BR-21, AC-06 | Complete Action and Ticket status matrices, active assignee/owner rules, and current-cycle resolution gate | Only listed transitions pass; terminal/tampered/inactive cases fail with the documented conflict code; a qualifying completed Action is required to resolve. | `server/tests/lab-04/ticket-workflow.policy.test.ts` | Planned |
| API-01 | API | AC-01 to AC-05 | List, create, assign, transition, complete, cancel, update Actions Taken with authenticated audit fields and stale-write handling | Response contains the authenticated creator/performer, active assignee, lifecycle timestamps, and incremented version; stale writes preserve stored data. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-03, AC-04 | Requester read-only access, cross-owner protection, role restrictions, inactive assignee rejection, and validation | Owner Requesters can read only; forbidden/cross-owner/invalid requests return the documented safe status and no mutation. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-06, AC-07 | Ticket transitions, active owner requirement, atomic resolution gate, reopen cycle, and advisory indication | Direct calls cannot bypass transition or resolution rules; reopening starts a new cycle; advisory indication never changes formal status. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-04 | API | AC-08, AC-10, AC-11 | Requester dashboard exact counts, closed seven-day resolvedAt boundary, bounded lists, drill-down, empty, and safe failures | Counts/lists match fixture queries, use one server clock and stable order, contain only the requester’s data, and return zero/empty on no data. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-05 | API | AC-09, AC-10, AC-11 | IT Staff dashboard exact operational buckets, current-user Actions, urgent window/order, filters, and forbidden access | Metrics and at most five urgent rows match authoritative queries and exact filters; Requesters receive 403 without metric data. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| AUTH-01 | Authorization | AC-03, AC-06, AC-08, AC-09, AC-11, AC-13 | Backend role matrix, owned-ticket isolation, active actor/assignee checks, CSRF/Origin protection, and no UI-only authorization | Every forbidden role/cross-owner/direct-call case is rejected with the documented safe status; permitted roles see only their scope and no secret fields. | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| MIG-01 | Integration | AC-13, AC-16 | Apply the real migration to an empty schema and run the seed | Migration succeeds, schema is usable, fixtures cover every major Ticket status, all priorities, assigned/unassigned ownership, zero/one/multiple Actions, non-zero metrics, and zero metrics; all required relations are valid. | `server/tests/lab-04/migration-regression.integration.test.ts` | Passing |
| MIG-02 | Integration | BR-29, AC-13 | Apply the migration to populated Lab 3 data and preserve existing records | Every captured legacy row/relationship count and timestamp remains unchanged; existing Tickets remain valid with zero Actions where expected. | `server/tests/lab-04/migration-regression.integration.test.ts` | Passing |
| MIG-03 | Recovery | BR-29, AC-16 | Force failure between migration steps inside a disposable database | Transaction rollback leaves no partial schema/data change and preflight counts match post-rollback counts. | `server/tests/lab-04/migration-recovery.integration.test.ts` | Passing |
| MIG-04 | Recovery | BR-29, AC-16 | Restore rehearsal from the preflight backup after a committed-step failure | Backup restores successfully, legacy row/relationship counts match, and the forward migration can be retried safely. | `server/tests/lab-04/migration-recovery.integration.test.ts` | Passing |
| MIG-05 | Integration | BR-29, AC-13 | Run the deterministic seed twice against user-edited and untouched fixture rows | No duplicate fixture rows are created; user-managed values are unchanged; missing fixtures are recreated only by stable `fixtureKey`. | `server/tests/lab-04/migration-regression.integration.test.ts` | Passing |
| UI-01 | UI | AC-12 | Actions Taken list, create, assign, transition, complete/cancel confirmation, edit, conditional follow-up validation, and read-only Requester view | Controls match role and lifecycle; validation is visible; terminal rows cannot be edited; form input survives recoverable failure. | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-02 | UI | AC-06, AC-07 | Permitted Ticket workflow options, resolution-gate feedback, confirmation, advisory indication, and conflict feedback | Only allowed options are shown; missing qualifying Action is explained; confirmation and stale refresh are accessible. | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-03 | UI | AC-08, AC-10, AC-11 | Requester Dashboard exact metrics, filters, bounded list, loading, empty, forbidden, and failure states | API values render without hard-coding; card/list links use the specified filters; states are recoverable. | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-04 | UI | AC-09, AC-10, AC-11 | IT Staff Dashboard exact metrics, operational buckets, urgent ordering, drill-down, and safe states | Counts and rows render from API data with exact Queue filters and no cross-role leakage. | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-05 | UI style | AC-14, AC-15 | Labels, focus, status cues, validation placement, confirmation dialogs, and design consistency | All controls have accessible names, non-color cues, visible focus, and no clipping/overlap. | `client/tests/lab-04/UiStyle.test.tsx` | Planned |
| REG-01 | Regression | AC-13, AC-16 | Lab 1 to Lab 3 client and server suites after Lab 4 integration | Existing suites pass without changed authorization, ownership, ticket-number, or timestamp behavior. | Existing `client/tests/lab-*` and `server/tests/lab-*` | Planned |
| PERF-01 | Performance smoke | AC-09, AC-16 | Staff dashboard and Ticket Action list with 10,000 Tickets and 50,000 Actions; five seeded runs after warm-up | p95 API response is <= 500 ms on the CI PostgreSQL service, payload remains bounded (<=5 urgent rows/<=20 attention rows), and query plans use the documented indexes. | `server/tests/lab-04/dashboard-performance.smoke.test.ts` | Planned |
| E2E-01 | E2E | AC-01 to AC-07 | Staff creates, assigns, transitions, completes, edits, and reviews multiple Actions Taken on one Ticket | The visible lifecycle and audit data match the API, and resolving is blocked until a current-cycle completed Action has a result. | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-06, AC-07 | Ticket transitions, resolution feedback, confirmation, reopen cycle, append-only history, and stale conflict behavior | Confirmation, backend gate, cycle reset, preserved Action/history data, and conflict recovery are observable and actionable. | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-08 to AC-11 | Requester and Staff dashboards, exact metrics, drill-down, empty, and role boundaries | Dashboards show authoritative values, bounded lists, exact destinations, safe empty/failure states, and no forbidden data. | `e2e/lab-04/dashboards.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-14, AC-15 | WCAG A/AA scan, semantic names, keyboard focus, dialogs, alerts, and status regions | No required accessibility violation is reported; keyboard and live-region behavior is observable. | `e2e/lab-04/dashboards.spec.ts` and shared accessibility helper | Planned |
| RESP-01 | Responsive | AC-14, AC-15 | Desktop, tablet, mobile screenshots and page-level overflow checks | Required viewports have no clipping, overlap, inaccessible control, or page-level horizontal overflow. | `e2e/lab-04/*.spec.ts` | Planned |

## 3. Acceptance-Criteria Traceability

| Acceptance criterion | Planned evidence |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | API-01, UI-01, E2E-01 |
| AC-03 | AUTH-01, API-02, UI-01, E2E-01 |
| AC-04 | UNIT-01, API-02, UI-01 |
| AC-05 | UNIT-01, API-01, UNIT-02, E2E-02 |
| AC-06 | AUTH-01, UNIT-02, API-03, UI-01, UI-02, E2E-01, E2E-02 |
| AC-07 | API-03, UI-02, E2E-02 |
| AC-08 | AUTH-01, API-04, UI-03, E2E-03 |
| AC-09 | AUTH-01, API-05, UI-04, PERF-01, E2E-03 |
| AC-10 | API-04, API-05, UI-03, UI-04, E2E-03 |
| AC-11 | AUTH-01, API-04, API-05, UI-03, UI-04, E2E-03 |
| AC-12 | API-01, UI-01, E2E-01 |
| AC-13 | MIG-01, MIG-02, MIG-05, REG-01 |
| AC-14 | RESP-01, A11Y-01, E2E-01, E2E-02, E2E-03 |
| AC-15 | UI-05, A11Y-01, RESP-01 |
| AC-16 | MIG-01, MIG-03, MIG-04, PERF-01, REG-01, E2E-01, E2E-02, E2E-03 |

## 4. Required Final Evidence

- API and integration output from isolated PostgreSQL schemas.
- Client UI test output with no skipped required tests.
- Complete Lab 1 to Lab 4 regression output from the reviewed integrated branch.
- Production build output.
- Three Lab 4 Playwright flows passing against the real client, server, authentication, CSRF, and database.
- Desktop 1440 x 1000, tablet 820 x 1180, and mobile 390 x 844 screenshots.
- Accessibility and page-level overflow results.
- Rendered `specification.md`, `api-spec.md`, `ui-spec.md`, and this test plan.

## 5. Final Verification Commands

The exact quality script may be added during final hardening. The final verification must include the equivalent of:

```powershell
npm run prisma:generate
npm run test:client
npm run test:server:isolated
npm run build
npx playwright test e2e/lab-04
git diff --check
```

The final report must record the actual commands, commit reference, test counts, and screenshot dimensions from `main`.
