# Lab 3 Test Plan, Traceability, and Results

## 1. Test Strategy

This plan is created before implementation. Lab 3 uses unit tests for pure policy and transition logic; API/integration tests for authentication, sessions, authorization, migrations, queue queries, workflow, and administration; React tests for role-specific UI behaviour; and Playwright E2E tests for complete user journeys and responsive evidence. Existing Lab 1 and Lab 2 tests remain part of regression verification.

No test may depend on test execution order or mutate shared seed records without restoring them. E2E fixtures use an explicit prefix and scoped cleanup.

## 2. Planned Automated Tests

| Test ID | Type | Requirement / AC | What it tests | Expected result | Planned file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-02, BR-04 | Email normalization and password policy boundaries | Valid inputs normalize; invalid values are rejected | `server/tests/lab-03/auth-policy.unit.test.ts` | Passed on Issue #28 branch |
| UNIT-02 | Unit | BR-05 | Login-attempt window and temporary lock calculations | Fifth failure locks; expiry and success reset safely | `server/tests/lab-03/auth-policy.unit.test.ts` | Passed on Issue #28 branch |
| UNIT-03 | Unit | AC-10 | Ticket status transition matrix and owner requirements | Only documented transitions are permitted | `server/tests/lab-03/status-policy.unit.test.ts` | Planned |
| UNIT-04 | Unit | BR-20 | Comment/note trimming and length limits | Empty/oversized content fails; valid content is preserved | `server/tests/lab-03/message-policy.unit.test.ts` | Planned |
| API-01 | API | AC-01 | Valid, invalid, inactive, unknown, blocked, and concurrent failed login | Safe response; five parallel failures are counted and lock the account | `server/tests/lab-03/auth.api.test.ts` | Passed on Issue #28 branch |
| API-02 | API | AC-02 | Initial-password login and mandatory change | Normal APIs remain blocked until valid change | `server/tests/lab-03/auth.api.test.ts` | Passed on Issue #28 branch |
| API-03 | API | AC-03 | Anonymous access, current user, expiry, logout, revocation, session version, and concurrent password-change/login | Invalid or stale sessions cannot continue or be published | `server/tests/lab-03/auth.api.test.ts` | Passed on Issue #28 branch |
| API-04 | Security/API | AC-03, AC-04 | Cookie, Origin, CSRF, legacy identity header, and role checks | Unsafe or unauthorized requests are rejected | `server/tests/lab-03/authorization.api.test.ts` | Passed on Issue #29 branch |
| API-05 | Security/API | AC-04, AC-05 | Cross-requester Ticket access plus Attachment list, upload, download, and delete | Same safe not-found response; no leakage or mutation | `server/tests/lab-03/authorization.api.test.ts` | Passed on Issue #29 branch |
| API-06 | Regression/API | AC-05, AC-06 | Authenticated Create/List/Detail/Attachment workflows | Lab 2 behaviour passes without requester header | `server/tests/lab-02/*.api.test.ts` | Passed on Issue #29 branch |
| API-07 | API | AC-06, AC-11 | Requester Public Comments and resolution indication | Owned actions succeed; formal staff actions fail | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-08 | API | AC-07 | Queue search/filter fields with AND semantics, owner scopes, sorting, tie-breaking, and pagination | Deterministic scoped results and metadata | `server/tests/lab-03/staff-queue.api.test.ts` | Passed on Issue #30 review-fix branch |
| API-09 | API | AC-07 | Invalid, repeated, empty, out-of-range, and forbidden queue requests | Safe `400 INVALID_QUERY` or `403 FORBIDDEN` | `server/tests/lab-03/staff-queue.api.test.ts` | Passed on Issue #30 review-fix branch |
| API-10 | API | AC-08 | Claim, unassign, active-owner assignment, and reassignment | Valid atomic ownership updates only | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API | AC-08, AC-09 | Stale assignment/priority updates and Requested Priority immutability | `409` on stale update; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-12 | API | AC-10 | Every permitted and forbidden status transition | Matrix and owner requirements enforced | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-13 | API | AC-11 | Public Comment visibility and Internal Note role restriction | Requester never receives note data | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-14 | API | AC-11 | Message validation, authorship, ordering, and safe rendering data | Backend author/time; append-only ordered records | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-15 | API | AC-12 | Admin list, search, role filter, create, edit, canonical email, one-role validation, and owner reconciliation | Documented user operations succeed safely; ineligible owners are unassigned without losing history | `server/tests/lab-03/admin-users.api.test.ts` | Passed on Issue #33 review-fix branch |
| API-16 | API | AC-12, AC-13 | Email collision, password boundaries/CSRF, initial-password reset, role/edit/deactivation session revocation | Conflict/success contracts are enforced and stale sessions end | `server/tests/lab-03/admin-users.api.test.ts` | Passed on Issue #33 review-fix branch |
| API-17 | API | AC-14 | Self-deactivation and concurrent last-active-Administrator protections | Serializable mutation permits exactly one concurrent removal and returns atomic `409 ADMIN_SAFETY_RULE` for the other | `server/tests/lab-03/admin-users.api.test.ts` | Passed on isolated PostgreSQL schema on Issue #33 review-fix branch |
| MIG-01 | Migration | AC-05 | Apply the actual migration history to empty and populated isolated PostgreSQL schemas | Lab 2 identity, Ticket/Attachment ownership, and IT Priority backfill remain correct | `server/tests/lab-03/migration.integration.test.ts` | Passed on Issue #27 branch |
| MIG-02 | Migration | AC-05, AC-16 | Seed repeat safety after editing User and lookup state | No duplicate fixtures and no user-managed state is overwritten | `server/tests/lab-03/migration.integration.test.ts` | Passed on Issue #27 branch |
| MIG-03 | Migration/Security | AC-01, AC-05 | Explicit provisioning, Argon2id, 12/128 password boundaries, and canonical email constraints | Missing credentials fail closed; mixed-case and duplicate canonical emails are rejected | `server/tests/lab-03/migration.integration.test.ts` | Passed on Issue #27 branch |
| UI-01 | UI | AC-01 | Login validation, busy, safe failure, and successful navigation | Accessible states and safe messages render | `client/tests/lab-03/Login.test.tsx` | Passed on Issue #28 branch |
| UI-02 | UI | AC-02 | Mandatory Change Password states and rules | Normal navigation blocked until success | `client/tests/lab-03/ChangePassword.test.tsx` | Passed on Issue #28 branch |
| UI-03 | UI/Security | AC-03, AC-04 | Role navigation, forbidden route, logout, and session expiry | Protected content/navigation is removed | `client/tests/lab-03/RoleNavigation.test.tsx` | Planned |
| UI-04 | UI/Regression | AC-05, AC-06 | Authenticated Requester identity and preserved Lab 2 screens | No selector; owned workflow remains functional | `client/tests/lab-03/RequesterRegression.test.tsx` | Passed on Issue #29 branch; comments and resolution remain planned |
| UI-05 | UI | AC-07 | Staff Queue loading, data, empty/no-results, forbidden/failure/retry, controls, pagination, and desktop/mobile structures | Every required state and role boundary is visible | `client/tests/lab-03/StaffQueue.test.tsx` | Passed on Issue #30 review-fix branch |
| UI-06 | UI | AC-08, AC-09, AC-10 | Staff assignment, priorities, transition controls, conflicts | Only permitted controls/actions are presented | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | UI/Security | AC-11 | Public Comments versus Internal Notes appearance and access | Distinct UI; requester has no Internal Note surface | `client/tests/lab-03/CommentsNotes.test.tsx` | Planned |
| UI-08 | UI | AC-12, AC-13, AC-14 | Admin list/create/edit/deactivate/role controls, reset, failure/retry, and safety conflicts | Complete minimalist management states render | `client/tests/lab-03/AdminUsers.test.tsx` | Passed on Issue #33 review-fix branch |
| E2E-01 | E2E | AC-01, AC-02, AC-03 | Initial login, mandatory change, authenticated shell, logout, direct-access denial | Full authentication lifecycle passes | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-05, AC-06, AC-11 | Requester creates/opens ticket, comments, uses attachment, indicates resolution | Authenticated Requester flow and isolation pass | `e2e/lab-03/requester-regression.spec.ts` | Planned |
| E2E-03 | E2E | AC-07-AC-11 | Staff finds ticket, claims/reassigns, changes priority/status, comments, and notes | Full operational flow passes | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-12-AC-14 | Admin creates/edits/deactivates user, resets password, and verifies safety rules | Full administration flow passes | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-05 | Responsive/A11y | AC-07, AC-15 | Staff Queue at 390x844 plus final major-screen visual suite | Mobile cards visible, table hidden, no requester actions or horizontal overflow | `e2e/lab-03/staff-queue-responsive.spec.ts` | Passed on Issue #30 review-fix branch; final multi-screen suite planned |

## 3. Acceptance-Criteria Traceability

| Acceptance criterion | Planned evidence |
| --- | --- |
| AC-01 | MIG-03, API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-02, E2E-01 |
| AC-03 | API-03, API-04, UI-03, E2E-01 |
| AC-04 | API-04, API-05, UI-03 |
| AC-05 | API-05, API-06, MIG-01, MIG-02, MIG-03, UI-04, E2E-02 |
| AC-06 | API-06, API-07, UI-04, E2E-02 |
| AC-07 | API-08, API-09, UI-05, E2E-03 |
| AC-08 | API-10, API-11, UI-06, E2E-03 |
| AC-09 | API-11, UI-06, E2E-03 |
| AC-10 | UNIT-03, API-12, UI-06, E2E-03 |
| AC-11 | UNIT-04, API-07, API-13, API-14, UI-07, E2E-02, E2E-03 |
| AC-12 | API-15, API-16, UI-08, E2E-04 |
| AC-13 | API-03, API-16, UI-08, E2E-04 |
| AC-14 | API-17, UI-08, E2E-04 |
| AC-15 | E2E-05 and completed `ui-spec.md` visual checklist |
| AC-16 | Complete final-main regression suite and the results below |

## 4. Manual and Visual Checks

- Confirm Public Comments and Internal Notes cannot be visually confused.
- Confirm every role sees only its permitted navigation and direct URLs remain backend-protected.
- Inspect Login, Change Password, Requester, Queue, Staff Detail, and User Management at all three required viewports.
- Confirm badge text, editable/read-only treatment, focus, validation placement, dialogs, and error states.
- Confirm no screenshot contains credentials, cookies, CSRF tokens, personal secrets, or unrelated local data.

## 5. Final Verification Commands

Run from final `main` after installing dependencies and preparing the documented local test database:

```powershell
npm run prisma:generate
npm test
npm run build
npx playwright test e2e/lab-03
git diff --check
```

Focused Issue #30 review verification:

```powershell
npm --workspace server test -- --run tests/lab-03/staff-queue.api.test.ts
npm --workspace client test -- --run tests/lab-03/StaffQueue.test.tsx
npx playwright test e2e/lab-03/staff-queue-responsive.spec.ts
npm run build
```

Focused Issue #33 review verification:

```powershell
npm --workspace server test -- --run tests/lab-03/admin-users.api.test.ts
npm --workspace client test -- --run tests/lab-03/AdminUsers.test.tsx
npm run build
```

The API test command was executed against a fresh isolated PostgreSQL schema after applying the real migration history and seed. Seven API tests passed. The Administrator UI suite passed four tests, and the client/server production build passed.

## 6. Final Results

Do not mark planned tests as passing until they run against the final integrated implementation.

| Suite | Expected | Final result |
| --- | --- | --- |
| Unit and policy tests | All pass; none skipped | Pending |
| API/integration and authorization tests | All pass; none skipped | Pending |
| Lab 1 and Lab 2 regression tests | All pass; none skipped | Pending |
| React UI component tests | All pass; none skipped | Pending |
| Migration and seed checks | Preserve data and pass repeat run | Pending |
| Playwright authentication, Requester, staff, admin, and responsive E2E | All pass | Pending |
| Client and server production build | Pass | Pending |
| Visual checklist | Complete from final `main` | Pending |
