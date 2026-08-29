# Lab 2 Test Plan and Traceability

This table is created before implementation. The Actual Status column is updated as each feature is completed and reviewed.

| Test ID | Acceptance Criteria | Level | Planned Test File | Scenario | Actual Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | AC-02, BR-01 | Unit | `server/tests/lab-02/ticket-number.test.ts` | Ticket Number generator produces unique, correctly formatted values. | Planned |
| UNIT-02 | AC-02, BR-07, BR-08 | Unit | `server/tests/lab-02/ticket-validation.test.ts` | Ticket input validator rejects missing, too short, too long, and invalid priority values. | Planned |
| UNIT-03 | AC-04, BR-09, BR-10 | Unit | `server/tests/lab-02/attachment-validation.test.ts` | Attachment validator checks extension, MIME type, size, and active-file count. | Planned |
| API-01 | AC-01, BR-03, BR-04 | API | `server/tests/lab-02/lookups.api.test.ts` | Active requesters are returned, inactive requesters are excluded, and active related systems are returned in name order. | Passed |
| API-02 | AC-02, BR-01, BR-02, BR-05 to BR-08 | API | `server/tests/lab-02/create-ticket.api.test.ts` | Valid ticket creation returns 201, a generated Ticket Number, status New, and requester ownership. | Passed |
| API-03 | AC-02, BR-07, BR-08, BR-12 | API | `server/tests/lab-02/create-ticket.api.test.ts` | Invalid fields, inactive requester, and invalid lookup values return safe errors. | Passed |
| API-04 | AC-03, BR-05 | API | `server/tests/lab-02/my-tickets.api.test.ts` | List returns only selected requester's tickets and rejects invalid paging/filter parameters. | Passed |
| API-05 | AC-03 | API | `server/tests/lab-02/my-tickets.api.test.ts` | Owner can retrieve a ticket; another requester receives a safe ownership failure. | Passed |
| API-06 | AC-04, BR-09 to BR-11 | API | `server/tests/lab-02/attachments.api.test.ts` | Upload, download, count limit, invalid file, ownership, and soft removal behaviour are verified. | Passed |
| API-07 | AC-02, BR-12 | API | `server/tests/lab-02/create-ticket.api.test.ts` | Repeating an identical create request with the same `Idempotency-Key` returns the original ticket and creates only one record; reusing that key with different ticket data returns `409`. | Passed |
| UI-01 | AC-01 | UI component | `client/tests/lab-02/RequesterSelection.test.tsx` | Selector renders loading, successful selection, empty, and API failure states. | Passed |
| UI-02 | AC-02, BR-12, BR-13 | UI component | `client/tests/lab-02/CreateTicket.test.tsx` | Form renders lookup data, validation errors, busy submit, success Ticket Number, and retained data after failure. | Passed |
| UI-03 | AC-03 | UI component | `client/tests/lab-02/MyTickets.test.tsx` | List displays API results rather than hard-coded data, plus empty, no-result, error, and pagination states. | Passed |
| UI-04 | AC-03, AC-04 | UI component | `client/tests/lab-02/MyTickets.test.tsx` | Detail displays ticket data and attachment metadata returned by the API. | Passed |
| UI-05 | AC-04 | UI component | `client/tests/lab-02/AttachmentSection.test.tsx` | Attachment validation, upload success/failure, and remove confirmation/error states are shown. | Passed |
| STYLE-01 | AC-05 | UI style | Client component tests | Zen Green primary actions, visible labels, error text, and active navigation are asserted. | Planned |
| RESP-01 | AC-05 | Responsive | Manual screenshots / E2E viewport checks | Requester Selection, Create Ticket, My Tickets, and Detail remain usable at desktop, tablet, and mobile widths. | Planned |
| E2E-01 | AC-01 to AC-03 | E2E | `e2e/lab-02/requester-ticket-flow.spec.ts` | Select requester, create a ticket, find it in My Tickets, and open Ticket Detail. | Planned |
| E2E-02 | AC-04 | E2E | `e2e/lab-02/requester-ticket-flow.spec.ts` | Upload a permitted attachment and confirm a removed attachment is unavailable. | Planned |

## Final Verification Commands

The exact scripts will be updated when Lab 2 test tooling is added. The intended final checks are:

```powershell
npm test
npm run build
npm run db:check
npm run prisma:seed
```

Manual verification also includes the requester selection, ticket success case, API/backend failure case, database failure case, attachment boundary cases, and responsive screenshots.
