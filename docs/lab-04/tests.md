# Lab 4 Test Plan and Traceability

## 1. Test-Driven Delivery

This test plan is created before the main Lab 4 implementation. Each acceptance criterion has planned evidence across unit, API/integration, UI, migration/regression, accessibility, responsive, and E2E layers. The final status will be recorded after the reviewed integrated branch passes.

## 2. Planned Test Matrix

| Test ID | Type | Requirement / AC | What it tests | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-01 to BR-12 | Action Taken validation, Unicode boundaries, follow-up conditional rules, and date rules | `server/tests/lab-04/actions-taken.policy.test.ts` | Planned |
| UNIT-02 | Unit | BR-13 to BR-17, AC-06 | Complete Ticket status matrix, owner gate, and resolution gate | `server/tests/lab-04/ticket-workflow.policy.test.ts` | Planned |
| API-01 | API | AC-01 to AC-05 | List, create, update Actions Taken with authenticated performer and stale-write handling | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-03, AC-04 | Requester read-only access, cross-owner protection, role restrictions, and validation | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-06, AC-07 | Status transitions, owner requirement, Resolved-to-Closed gate, and advisory indication | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-04 | API | AC-08, AC-10, AC-11 | Requester dashboard calculations, ownership, drill-down, empty, and safe failures | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-05 | API | AC-09, AC-10, AC-11 | IT Staff dashboard calculations, current-user Actions Taken, and forbidden access | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| MIG-01 | Integration | AC-13, AC-16 | Apply the real migration to an empty schema and run the seed | `server/tests/lab-04/migration-regression.integration.test.ts` | Planned |
| MIG-02 | Integration | BR-24, AC-13 | Apply the migration to populated Lab 3 data and preserve existing records | `server/tests/lab-04/migration-regression.integration.test.ts` | Planned |
| UI-01 | UI | AC-12 | Actions Taken list, create, edit, conditional follow-up validation, and read-only Requester view | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-02 | UI | AC-06, AC-07 | Permitted workflow options, confirmation, advisory indication, and conflict feedback | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-03 | UI | AC-08, AC-10, AC-11 | Requester Dashboard metrics, drill-down, loading, empty, forbidden, and failure states | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-04 | UI | AC-09, AC-10, AC-11 | IT Staff Dashboard metrics, filters, drill-down, and safe states | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-05 | UI style | AC-14, AC-15 | Labels, focus, status cues, validation placement, and design consistency | `client/tests/lab-04/UiStyle.test.tsx` | Planned |
| REG-01 | Regression | AC-13, AC-16 | Lab 1 to Lab 3 client and server suites after Lab 4 integration | Existing `client/tests/lab-*` and `server/tests/lab-*` | Planned |
| E2E-01 | E2E | AC-01 to AC-07 | Staff creates, edits, and reviews multiple Actions Taken on one Ticket | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-06, AC-07 | Ticket transitions, resolution feedback, confirmation, and stale conflict behavior | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-08 to AC-11 | Requester and Staff dashboards, metrics, drill-down, empty, and role boundaries | `e2e/lab-04/dashboards.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-14, AC-15 | WCAG A/AA scan, semantic names, keyboard focus, dialogs, alerts, and status regions | `e2e/lab-04/dashboards.spec.ts` and shared accessibility helper | Planned |
| RESP-01 | Responsive | AC-14, AC-15 | Desktop, tablet, mobile screenshots and page-level overflow checks | `e2e/lab-04/*.spec.ts` | Planned |

## 3. Acceptance-Criteria Traceability

| Acceptance criterion | Planned evidence |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | API-01, UI-01, E2E-01 |
| AC-03 | API-02, UI-01, E2E-01 |
| AC-04 | UNIT-01, API-02, UI-01 |
| AC-05 | API-01, UNIT-02, E2E-02 |
| AC-06 | UNIT-02, API-03, UI-02, E2E-02 |
| AC-07 | API-03, UI-02, E2E-02 |
| AC-08 | API-04, UI-03, E2E-03 |
| AC-09 | API-05, UI-04, E2E-03 |
| AC-10 | API-04, API-05, UI-03, UI-04, E2E-03 |
| AC-11 | API-04, API-05, UI-03, UI-04, E2E-03 |
| AC-12 | API-01, UI-01, E2E-01 |
| AC-13 | MIG-01, MIG-02, REG-01 |
| AC-14 | RESP-01, A11Y-01, E2E-01, E2E-02, E2E-03 |
| AC-15 | UI-05, A11Y-01, RESP-01 |
| AC-16 | REG-01, E2E-01, E2E-02, E2E-03 |

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
