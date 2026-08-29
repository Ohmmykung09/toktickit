# Lab 2 Test Plan, Traceability, and Results

## Test Strategy

Lab 2 uses unit tests for pure Ticket Number behaviour, API tests for database and ownership contracts, UI component tests for requester-visible states, a browser E2E flow for the main requester journey, and screenshot-based responsive/visual inspection. No automated test is intentionally skipped.

## Automated Test Traceability

| Test ID | Acceptance Criteria / Rules | Level | Actual Test File | Evidence | Status on feature branch |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | AC-02, BR-01, BR-02 | Unit | `server/tests/lab-02/ticket-number.test.ts` | UTC Ticket Number prefix and system-managed response fields | Passed |
| API-01 | AC-01, BR-03, BR-04 | API | `server/tests/lab-02/lookups.api.test.ts` | Complete active Requester and Related System lists | Passed |
| API-02 | AC-02, BR-01, BR-02, BR-06 to BR-08, BR-12 | API | `server/tests/lab-02/create-ticket.api.test.ts` | Valid creation, validation, ownership context, idempotent retry, and conflict | Passed |
| API-03 | AC-03, BR-05 | API | `server/tests/lab-02/my-tickets.api.test.ts` | Requester-owned list, filters, pagination, and invalid query rejection | Passed |
| API-04 | AC-03, BR-05 | API | `server/tests/lab-02/ticket-detail.api.test.ts` | Owned detail response and cross-requester denial | Passed |
| API-05 | AC-04, BR-09 to BR-11 | API | `server/tests/lab-02/attachments.api.test.ts` | Upload, list, download, file limits, ownership, and soft removal | Passed |
| UI-01 | AC-01, BR-03, BR-04 | UI | `client/tests/lab-02/RequesterSelection.test.tsx` | Loading, ready, empty, and backend-failure selector states | Passed |
| UI-02 | AC-02, BR-07, BR-08, BR-12, BR-13 | UI | `client/tests/lab-02/CreateTicket.test.tsx` | Lookup values, validation, busy submit, success, and retained form data after failure | Passed |
| UI-03 | AC-03, BR-05 | UI | `client/tests/lab-02/MyTickets.test.tsx` | API-driven ticket list/detail navigation and list failure state | Passed |
| UI-04 | AC-03, BR-05 | UI | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | API-driven requester-owned detail fields and no-attachment state | Passed |
| UI-05 | AC-04, BR-09 to BR-11, BR-13 | UI | `client/tests/lab-02/AttachmentSection.test.tsx` | Valid/invalid file selection, upload success, `204` removal, and non-JSON `413` failure | Passed |
| E2E-01 | AC-01 to AC-04 | Browser E2E | `e2e/lab-02/requester-ticket-flow.spec.ts` | Select requester, create ticket, find/open it, upload, and remove an attachment | Passed |

## Acceptance-Criterion Matrix

| Acceptance Criterion | Primary automated evidence | Manual / visual evidence |
| --- | --- | --- |
| AC-01 Development Requester Selection | API-01, UI-01, E2E-01 | Selector loading, empty, error, selected requester, and Change Requester screenshots |
| AC-02 Create Ticket | UNIT-01, API-02, UI-02, E2E-01 | Desktop initial, validation, submitting, success, API failure, and invalid attachment screenshots |
| AC-03 My Tickets and Ticket Detail | API-03, API-04, UI-03, UI-04, E2E-01 | Requester A/B ownership, search, filters, sorting, pagination, empty/no-results, and direct-access evidence |
| AC-04 Attachments | API-05, UI-05, E2E-01 | Upload, download, soft removal, retained metadata, and blocked removed-download evidence |
| AC-05 User Experience | UI-01 to UI-05 | Desktop, tablet, and mobile Zen Green visual checklist |

## Commands

Run from the repository root after creating `server/.env`, applying migrations, and seeding PostgreSQL:

```powershell
npm run db:check
npm run prisma:seed
npm test
npm run build
```

Install the Playwright test runner and Chromium browser, then run the browser E2E test:

```powershell
npm install --save-dev playwright@1.62.1
npx playwright install chromium
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

## Responsive and Visual Checklist

Record the following screenshots only after the final release is merged into `main`. Save the originals under `artifacts/lab-02/screenshots/` and use readable copies in the submitted PDF.

| Viewport | Screens | Checks |
| --- | --- | --- |
| Desktop, 1440 x 900 | Requester Selection, Create Ticket, My Tickets, Ticket Detail | Zen Green action hierarchy, readable labels, field-level validation, system-generated/read-only values, and no overlap |
| Tablet, 768 x 1024 | Create Ticket, My Tickets, Ticket Detail | Controls remain tappable, filters stay usable, and detail content wraps without clipping |
| Mobile, 390 x 844 | Requester Selection, Create Ticket, My Tickets, Ticket Detail | Navigation is reachable, fields fit viewport width, ticket table scrolls or remains readable, and no horizontal page overflow |

Before taking each screenshot verify:

- Visible focus and text labels are present; color is not the only state indicator.
- Required-field and server-error messages appear next to the affected action or field.
- Primary, secondary, destructive, disabled, and busy button states are distinguishable.
- No clipped text, overlapping controls, broken layout, or unexpected horizontal page scroll is visible.
- Requester name, ticket ownership, attachment count/limit, and removed-file state match the selected test data.

## Final Evidence Status

The automated unit, API, UI, and E2E suites passed on this feature branch before review. The E2E run and screenshot checklist must be repeated on the reviewed `main` branch before final PDF submission; that branch is the final source of truth.
