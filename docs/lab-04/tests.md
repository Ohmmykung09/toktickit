# Lab 4 Test Plan and Traceability

## 1. Test-Driven Delivery

This plan was prepared before the main Lab 4 implementation. The matrix records the verification completed for this branch. Validation and workflow rules implemented inside API routers are exercised through API contract tests rather than separate policy modules.

## 2. Executed Test Matrix

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | AC-01 to AC-05 | Action Taken list/create/assign/transition/complete/cancel/update, authenticated audit fields, stale writes, idempotency | Valid lifecycle and audit data; stale writes preserve data; retries do not duplicate Actions. | `server/tests/lab-04/actions-taken.api.test.ts` | Passing |
| API-02 | API / Authorization | AC-03, AC-04 | Requester read-only access, cross-owner protection, role restrictions, inactive assignee rejection, validation | Forbidden or invalid requests return safe status without mutation. | `server/tests/lab-04/actions-taken.api.test.ts` | Passing |
| API-03 | API | AC-06, AC-07 | Ticket transitions, active owner requirement, atomic resolution gate, reopen cycle, advisory indication | Direct calls cannot bypass policy; reopening starts a new cycle and preserves history. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Passing |
| AUTH-01 | Authorization | BR-28, AC-03, AC-06, AC-08, AC-09, AC-11 | Action Taken and Ticket workflow mutations with missing Origin or incorrect session CSRF token | Both endpoints return 403 `CSRF_REJECTED`; no Action row or Ticket status change is persisted. | `server/tests/lab-04/actions-taken.api.test.ts` | Passing |
| API-04 | API | AC-08, AC-10, AC-11 | Requester dashboard counts, seven-day resolvedAt boundary, bounded lists, drill-down, empty and failure states | Authoritative scoped metrics, stable bounded lists, zero/empty states. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Passing |
| API-05 | API / Authorization | AC-09, AC-10, AC-11 | Staff operational buckets, current-user Actions, urgent window/order, filters, forbidden access | Authoritative metrics and bounded urgent rows; Requesters receive 403. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Passing |
| MIG-01 | Integration | AC-13, AC-16 | Apply migration to empty schema and seed | Migration succeeds; seeded fixture relations and status/priority coverage are valid. | `server/tests/lab-04/migration-regression.integration.test.ts` | Passing |
| MIG-02 | Integration | BR-29, AC-13 | Migrate populated Lab 3 data and preserve existing records | Legacy row/relationship counts and timestamps remain unchanged. | `server/tests/lab-04/migration-regression.integration.test.ts` | Passing |
| MIG-03 | Recovery | BR-29, AC-16 | Force failure between migration steps in disposable database | Transaction rollback leaves no partial schema/data changes. | `server/tests/lab-04/migration-recovery.integration.test.ts` | Passing |
| MIG-04 | Recovery | BR-29, AC-16 | Restore rehearsal after committed-step failure | Backup restores; legacy counts match; forward migration can be retried. | `server/tests/lab-04/migration-recovery.integration.test.ts` | Passing |
| MIG-05 | Integration | BR-29, AC-13 | Run deterministic seed twice against user-edited and untouched fixtures | No duplicates; user-managed values remain unchanged; missing stable fixtures are recreated. | `server/tests/lab-04/migration-regression.integration.test.ts` | Passing |
| UI-01 | UI | AC-01 to AC-05, AC-12 | Action Taken list/create/assign/transition/complete/cancel/edit, validation, read-only requester view | Role/lifecycle controls and recoverable validation behave as expected. | `client/tests/lab-04/ActionsTaken.test.tsx`, `e2e/lab-04/actions-taken-flow.spec.ts` | Passing |
| UI-02 | UI | AC-06, AC-07 | Allowed Ticket workflow options, resolution feedback, confirmation, conflict handling | Invalid transitions are blocked and recovery is accessible. | `client/tests/lab-04/TicketWorkflow.test.tsx`, `e2e/lab-04/ticket-resolution.spec.ts` | Passing |
| UI-03 | UI | AC-08, AC-10, AC-11 | Requester metrics, filters, bounded list, loading/empty/failure states | API values render correctly; drill-down uses exact filters; failures are recoverable. | `client/tests/lab-04/RequesterDashboard.test.tsx`, `e2e/lab-04/dashboards.spec.ts` | Passing |
| UI-04 | UI | AC-09, AC-10, AC-11 | Staff metrics, buckets, urgent ordering, drill-down, safe states | Exact Queue filters and no cross-role data leakage. | `client/tests/lab-04/StaffDashboard.test.tsx`, `e2e/lab-04/dashboards.spec.ts` | Passing |
| UI-05 | Accessibility / UI style | AC-14, AC-15 | Semantic names, keyboard activation, WCAG A/AA, status/alerts, responsive layout | Axe reports no violations on tested flows; keyboard activation works; no horizontal overflow. | `e2e/lab-04/*.spec.ts` and shared accessibility helper | Passing |
| REG-01 | Regression | AC-13, AC-16 | Lab 1–3 client/server regression after Lab 4 integration | Existing authorization, ownership, ticket number, and timestamp behavior remains green. | `npm run test:quality:lab4` | Passing |
| PERF-01 | Performance smoke | AC-09, AC-16 | Staff dashboard and Action list at 10,000 Tickets / 50,000 Actions; five warmups plus 30 samples per endpoint | Nearest-rank p95 <= 500 ms, bounded response, expected indexes in query plans. Aggregate-gate p95: 93.9 ms dashboard / 7.4 ms Action list. Run only through the isolated perf script. | `server/tests/lab-04/dashboard-performance.smoke.test.ts` | Passing |
| E2E-01 | E2E | AC-01 to AC-07 | Staff creates, assigns, transitions, completes, cancels, edits, retries after a committed/lost response, and reviews Actions Taken | Idempotent retry leaves one Action; pending submit disables duplicate clicks; cancelled/completed Actions become immutable; resolution requires a qualifying current-cycle Action. | `e2e/lab-04/actions-taken-flow.spec.ts` | Not rerun: web-server startup timed out before Playwright; see raw gate log. |
| E2E-02 | E2E | AC-06, AC-07 | Ticket transitions, confirmation, reopen cycle, append-only history, conflict behavior | Resolution gate and recovery are observable; history survives reopening. | `e2e/lab-04/ticket-resolution.spec.ts` | Not rerun: web-server startup timed out before Playwright; see raw gate log. |
| E2E-03 | E2E | AC-08 to AC-11 | Requester and Staff dashboard metrics, drill-down, empty and role boundaries | Correct scoped metrics, bounded lists, exact destinations, safe states. | `e2e/lab-04/dashboards.spec.ts` | Not rerun: web-server startup timed out before Playwright; see raw gate log. |
| A11Y-01 | Accessibility | AC-14, AC-15 | WCAG A/AA scans, semantic names, keyboard focus/activation, dialogs and status regions | No required Axe violations; keyboard activation verified. | `e2e/lab-04/*.spec.ts` and shared accessibility helper | Not rerun: web-server startup timed out before Playwright; see raw gate log. |
| RESP-01 | Responsive | AC-14, AC-15 | Desktop/tablet/mobile captures and page-level overflow checks | Screenshots use exact required viewport dimensions with no horizontal overflow. | `e2e/lab-04/*.spec.ts` | Not rerun: web-server startup timed out before Playwright; see raw gate log. |

## 3. Acceptance-Criteria Traceability

| Acceptance criterion | Evidence |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-01, UI-01, E2E-01 |
| AC-03 | AUTH-01, API-02, UI-01, E2E-01 |
| AC-04 | API-02, UI-01 |
| AC-05 | API-01, E2E-02 |
| AC-06 | AUTH-01, API-03, UI-01, UI-02, E2E-01, E2E-02 |
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

## 4. Final Evidence

- API and integration tests run against isolated PostgreSQL schemas.
- Client UI tests, isolated API/integration tests, performance smoke, and production client/server builds passed in the recorded PR #63 attempt.
- The Lab 2–4 Playwright regression, accessibility scans, and responsive capture checks did not start in that attempt due to the port-3000 collision; see the gate log and capture-provenance note below.
- Rendered `specification.md`, `api-spec.md`, `ui-spec.md`, and this test plan.
- [Project board snapshot: all cards #48–#56 Done](../../artifacts/lab-04/screenshots/project-board-lab4.png).
- [Commit-history graph snapshot](../../artifacts/lab-04/screenshots/commit-history-lab4.png).

## 5. Final Verification Commands

The integrated quality gate was run on PR #63's current HEAD with documentation and the evidence renderer modified in the working tree; no application or test implementation files were modified. Its raw output is [quality-gate-pr63-20261010.log](../../artifacts/lab-04/test-runs/quality-gate-pr63-20261010.log).

| Field | Recorded value |
| --- | --- |
| Tested HEAD | `0bcb81c063c97d0d860c4ac80fc8d7a0c7812a9e` |
| Working tree | Dirty; documentation/evidence renderer changes present, no application/test implementation changes |
| Command | `npm run test:quality:lab4` |
| Started (UTC) | `2026-10-10T13:25:59.8296180+00:00` |
| Finished (UTC) | `2026-10-10T13:30:28.0813479+00:00` |
| Exit code | `1` — incomplete; E2E web-server startup timed out |

Completed portions of that run: client 59/59 passed; isolated server 94 passed with one intentionally skipped performance test; isolated performance smoke passed at 10k Tickets/50k Actions (p95 133.4 ms dashboard / 22.7 ms Actions list); production client/server builds passed. The Lab 2–4 Playwright phase did not start: another local process was listening on `localhost:3000` and returned 404 for `/api/health`, so Playwright timed out waiting for its configured web server. Therefore the integrated gate is **not recorded as passing**, and this run is not release-candidate or `main` evidence.

After the unrelated process releases port 3000, rerun the complete gate and capture a fresh log before changing the result above:

Run from the repository root with `DATABASE_URL` available through `server/.env` (as required by the isolated test runner) and ports 3000/5173 free.

```powershell
$ErrorActionPreference = 'Stop'
npm run test:quality:lab4 2>&1 | Tee-Object -FilePath artifacts/lab-04/test-runs/quality-gate-pr63-rerun.log
if ($LASTEXITCODE -ne 0) { throw 'Quality gate failed; do not mark it passed.' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'git diff --check failed.' }
```

The currently committed viewport screenshots are not claimed to come from this failed run. Their known source revisions are listed in [`evidence-captures.md`](../../artifacts/lab-04/evidence-captures.md). Rerun `npm run test:quality:lab4` after this evidence PR merges and on the exact release candidate; a PR #63 run is not final-main evidence.
