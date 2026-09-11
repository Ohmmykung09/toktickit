# Lab 3 Specification: Authenticated IT Service Operations

## 1. Sprint Goal

Lab 3 replaces the temporary Development Requester selector with authenticated users and role-based authorization while preserving the completed Lab 2 requester workflows. The increment adds secure login and mandatory first-password change, an operational IT Staff ticket workflow, Public Comments and Internal Notes, and minimalist Administrator user management.

## 2. Stakeholder Request

TokTickIT must identify each user from a secure authenticated session instead of a client-selected requester ID. Requesters continue to manage only their own tickets. IT Staff receive a shared queue and controlled ticket operations. Administrators manage accounts and initial passwords. Every role and ownership rule is enforced by the backend, while the frontend presents only permitted navigation and actions.

## 3. Scope

### Included

- Email/password login, logout, current-user retrieval, session expiry, and mandatory first-login password change.
- One role per user: Requester, IT Staff, or Administrator.
- Server-side role and ownership authorization for every protected endpoint.
- Migration of Lab 2 Development Requesters and their existing ticket ownership to authenticated Users.
- All Lab 2 Requester ticket and attachment behaviour using the authenticated identity.
- Requester Public Comments and a Problem Appears Resolved indication.
- IT Staff Ticket Queue with search, filters, sorting, pagination, and responsive layouts.
- Ticket claim/reassignment, IT Priority, status transitions, Public Comments, and Internal Notes.
- Administrator user list, search, optional role filter, create/edit, activation, role assignment, and initial-password reset.
- Zen Green responsive UI, automated tests, visual evidence, peer review, and staged release evidence.

### Excluded

- Self-registration, email invitations, password-reset email, MFA, social login, and SSO.
- Multiple roles per user, departments, organizations, profile photos, and account-history screens.
- User deletion, bulk user operations, import/export, and advanced user-list sorting or pagination.
- Actions Taken, SLA calculation, escalation, notifications, dashboards, and analytics.
- Production deployment and cloud infrastructure changes.
- Editing or deleting Public Comments and Internal Notes.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | The system shall authenticate an active user using a normalized email address and password. |
| FR-02 | The system shall establish an expiring server-side session and expose only safe current-user data. |
| FR-03 | A user with an initial password shall be restricted to password change and logout until a valid new password is saved. |
| FR-04 | The system shall invalidate the current session on logout and reject later protected requests. |
| FR-05 | The application shell shall display the authenticated user's name and role and show role-permitted navigation only. |
| FR-06 | The backend shall authorize every protected operation by authenticated role and resource ownership. |
| FR-07 | The Lab 2 Development Requester selector and `X-Development-Requester-Id` header shall be removed. |
| FR-08 | An authenticated Requester shall retain Create Ticket, My Tickets, Ticket Detail, and Attachment functions for owned tickets only. |
| FR-09 | A Requester shall be able to post Public Comments and record that the problem appears resolved on an owned ticket. |
| FR-10 | IT Staff and Administrators shall be able to retrieve a shared Ticket Queue with documented search, filters, sorting, and pagination. |
| FR-11 | IT Staff and Administrators shall be able to open protected operational Ticket Detail. |
| FR-12 | IT Staff and Administrators shall be able to claim or reassign a ticket to an active permitted owner. |
| FR-13 | IT Staff and Administrators shall be able to set IT Priority without changing Requested Priority. |
| FR-14 | IT Staff and Administrators shall be able to perform only permitted status transitions. |
| FR-15 | Requesters, IT Staff, and Administrators shall be able to create and read Public Comments on tickets they may access. |
| FR-16 | Only IT Staff and Administrators shall be able to create and read Internal Notes. |
| FR-17 | An Administrator shall be able to list users, search by name/email, and optionally filter by role. |
| FR-18 | An Administrator shall be able to create one user with one permitted role, activation state, and initial password. |
| FR-19 | An Administrator shall be able to edit a user's name, normalized email, role, and activation state. |
| FR-20 | An Administrator shall be able to set a new initial password that requires a change at the user's next login. |
| FR-21 | All major screens shall provide meaningful loading, busy, validation, success, empty/no-results, forbidden, not-found, conflict, and safe failure feedback. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | Only an active user with valid credentials may authenticate. Login failure messages do not reveal whether an email exists, is inactive, is temporarily locked, or has the wrong password. |
| BR-02 | Email identity is trimmed and stored in lowercase. Its maximum length is 254 characters and it is unique case-insensitively. |
| BR-03 | Passwords are never stored or logged in plaintext. They are hashed with Argon2id using 19,456 KiB memory, two iterations, and parallelism one. |
| BR-04 | A valid password contains 12 to 128 characters and at least three of uppercase, lowercase, digit, and symbol character classes. It must not equal the normalized email address. |
| BR-05 | Five failed login attempts within 15 minutes temporarily block further attempts for 15 minutes. A successful login resets the counters; the response remains generic. |
| BR-06 | A user marked `mustChangePassword` cannot access normal application APIs or screens. Only current-user, change-password, and logout operations are permitted. |
| BR-07 | A changed password must differ from the current password. Changing or administratively resetting a password revokes all existing sessions for that user. |
| BR-08 | Session tokens are random, stored only as hashes in PostgreSQL, bound to the user's current session version, delivered through an `HttpOnly` cookie, and expire after eight hours. Logout revokes the server session and clears the cookie. |
| BR-09 | State-changing cookie-authenticated requests require both an approved Origin and a session-bound CSRF token. |
| BR-10 | Each user has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. Unknown role values are rejected. |
| BR-11 | Backend authorization is authoritative. Hidden or disabled frontend controls do not grant or enforce access. |
| BR-12 | The authenticated User ID, never a requester ID supplied by the client, determines ownership of Requester operations. |
| BR-13 | A Requester can list, retrieve, comment on, indicate apparent resolution for, and manage permitted attachments only on owned tickets. Cross-owner resources use the same safe not-found response as missing resources. |
| BR-14 | Requested Priority remains the Requester's immutable submitted value. IT Priority initially copies Requested Priority and may be changed only by IT Staff or Administrators. |
| BR-15 | A Ticket is initially unassigned and may have at most one primary owner who is an active IT Staff or Administrator. |
| BR-16 | Claim assigns an unowned ticket to the acting IT Staff or Administrator. Reassignment requires a currently active permitted target user. |
| BR-17 | Entering `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, or `CLOSED` requires an assigned owner. |
| BR-18 | A Requester's Problem Appears Resolved action records the requester and backend timestamp but does not change the formal ticket status. Repeated requests are idempotent. |
| BR-19 | Public Comments are visible to Requesters with ownership and to IT Staff and Administrators. Internal Notes are visible only to IT Staff and Administrators. |
| BR-20 | Public Comments and Internal Notes are append-only, trimmed, 1 to 2,000 characters, safely rendered as text, and record backend-derived author and creation time. |
| BR-21 | Status, ownership, and IT Priority updates use optimistic concurrency through the current `updatedAt` value. Stale updates return `409 CONFLICT`. |
| BR-22 | Transitions to `RESOLVED`, `CLOSED`, or `CANCELLED` require explicit UI confirmation. Actions Taken are not required in Lab 3. |
| BR-23 | An Administrator may perform ticket operations explicitly allowed by the authorization matrix, in addition to user administration. The role remains a single Administrator role. |
| BR-24 | An Administrator creates a user with one role and an initial password. The created user must change that password at first login. |
| BR-25 | An Administrator may update name, email, role, and activation state but may not delete a user. Historical ticket, comment, note, and attachment authorship remains valid. |
| BR-26 | An Administrator cannot deactivate their own account or deactivate/demote the last active Administrator. These checks are atomic in the database transaction. |
| BR-27 | Setting a new initial password sets `mustChangePassword`, revokes the target user's sessions, and does not return or log the password. |
| BR-28 | Deactivated users cannot create new sessions. Their existing sessions are revoked, but their historical records remain visible to authorized users. |
| BR-29 | All validation, authentication, authorization, conflict, missing-resource, and unexpected-failure responses use safe JSON and never expose password hashes, session tokens, storage paths, stack traces, or protected-resource existence. |
| BR-30 | Lab 2 tickets, attachments, ticket numbers, idempotency behaviour, lookup history, and requester ownership remain correct after migration. |

## 6. Authorization Matrix

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| View own profile / logout / change own password | Allow | Allow | Allow |
| Create and list requester-owned tickets | Own only | Deny | Deny |
| View requester Ticket Detail and manage attachments | Own only | Through staff detail | Through staff detail |
| Add/read Public Comments | Own tickets | All tickets | All tickets |
| Indicate Problem Appears Resolved | Own tickets | Deny | Deny |
| View shared Ticket Queue | Deny | Allow | Allow |
| Claim/reassign Ticket | Deny | Allow | Allow |
| Change IT Priority or status | Deny | Allow | Allow |
| Add/read Internal Notes | Deny | Allow | Allow |
| List/create/edit/deactivate users | Deny | Deny | Allow |
| Set another user's initial password | Deny | Deny | Allow |

Every deny is enforced by the API even when a URL or request is constructed manually.

## 7. Ticket Status Transition Matrix

| Current status | Permitted next status | Additional rule |
| --- | --- | --- |
| `NEW` | `OPEN`, `IN_PROGRESS`, `CANCELLED` | `IN_PROGRESS` requires an owner. `CANCELLED` requires confirmation. |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Operational states require an owner; terminal transition requires confirmation. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Requires an owner; terminal transition requires confirmation. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | Requires an owner; terminal transition requires confirmation. |
| `RESOLVED` | `CLOSED`, `REOPENED` | Both require confirmation; `REOPENED` retains history. |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Requires an owner. |
| `CLOSED` | `REOPENED` | Requires confirmation and an owner. |
| `CANCELLED` | None | Final in Lab 3. |

Only IT Staff and Administrators may perform these transitions. A transition to the current status is rejected as validation error rather than creating a false update.

## 8. Data and Migration Decisions

### Models and fields

- `User`: ID, name, normalized unique email, password hash, role, active flag, mandatory-password-change flag, failed-login counters, optional lock expiry, timestamps, and session version.
- `Session`: hashed random token, hashed CSRF token, User relation, captured session version, expiry, optional revocation time, created time, and last-used time.
- `Ticket`: Requester User relation, optional owner User relation, Requested Priority, IT Priority, expanded status enum, optional requester-resolution indication fields, and existing Lab 2 fields.
- `PublicComment`: Ticket, author User, content, and backend creation time.
- `InternalNote`: Ticket, author User, content, and backend creation time.
- `Attachment`: existing data remains valid; remover relation changes from Development Requester to User without exposing internal IDs through APIs.

Indexes support normalized email lookup, active users by role/name, session token/expiry, queue filters/order, owner/status/priority, and comment/note chronological retrieval.

### Migration sequence

1. Create role/session/comment/note structures and add nullable Lab 3 Ticket fields.
2. Create one `REQUESTER` User for every Development Requester while preserving stable IDs where possible.
3. Leave migrated accounts explicitly unprovisioned with a null password hash. Provision them only when the seed receives an explicit local-only password through the ignored environment, then set `mustChangePassword = true`.
4. Backfill Ticket requester ownership and Attachment remover references to User.
5. Copy Requested Priority into IT Priority and retain the existing `NEW` status.
6. Add foreign keys, uniqueness, and non-null constraints only after validation queries pass.
7. Remove the Development Requester table and temporary selector state after ownership parity is verified.

The migration must run without deleting existing Categories, Related Systems, Tickets, Attachments, files, ticket numbers, or timestamps. A rollback or failed migration must leave the previous schema and data usable.

### Seed decisions

- Seed is idempotent and uses stable normalized email keys.
- Include at least four active and one inactive Requester, three active and one inactive IT Staff, and one active Administrator.
- Include assigned and unassigned tickets across all required statuses and priority levels.
- Include safe example Public Comments and Internal Notes.
- Seed credentials are supplied explicitly through ignored local configuration. The seed fails before database work when the value is absent, and no usable default password or real secret is committed.
- Repeat runs create only missing fixtures and provision only accounts whose credential state is still null. Existing names, roles, activation state, hashes, password-change state, and login-attempt state are preserved.

## 9. UI Summary

- Login and mandatory Change Password are public-shell screens with safe validation and busy/failure states.
- The authenticated shell shows the current user's name and role, Logout, and role-specific navigation.
- Requester screens preserve Lab 2 behaviour, remove requester switching, and add Public Comments and Problem Appears Resolved.
- IT Staff screens provide a responsive queue and operational Ticket Detail with visually distinct Public Comments and Internal Notes.
- Administrator User Management provides one focused responsive list and create/edit flow.
- All screens follow `docs/lab-03/ui-spec.md` and the existing Zen Green tokens.

## 10. Acceptance Criteria

| ID | Observable criterion |
| --- | --- |
| AC-01 | An active user with valid credentials receives authenticated access and only safe user identity/role data. Invalid, inactive, or temporarily blocked login attempts receive a safe generic response. |
| AC-02 | A user with an initial password can access only password change and logout until a valid different password is saved. |
| AC-03 | Logout revokes the session; expired, revoked, or malformed sessions cannot access a protected UI route or API. |
| AC-04 | Direct API calls outside the authenticated role are rejected, and protected resource existence is not leaked. |
| AC-05 | Migrated Requesters can access their existing Lab 2 tickets and attachments using authenticated identity, with no selector or requester header. |
| AC-06 | A Requester can create/list/view owned tickets, manage permitted attachments, add Public Comments, and indicate apparent resolution, but cannot access other Requesters' data or formal staff actions. |
| AC-07 | IT Staff and Administrators can retrieve a deterministic Ticket Queue with documented search, filter, sort, pagination, empty, no-results, forbidden, and failure behaviour. |
| AC-08 | An authorized staff user can claim or reassign a ticket only to an active permitted owner, with stale updates rejected safely. |
| AC-09 | Requested Priority remains unchanged while authorized users can update IT Priority independently. |
| AC-10 | Only transitions in the approved matrix succeed, required ownership and confirmations are enforced, and Requesters cannot formally resolve or close tickets. |
| AC-11 | Public Comments are shared with permitted participants, while Internal Notes are unavailable to Requesters through both UI and direct API access. |
| AC-12 | An Administrator can list/search/filter, create, and edit users with one permitted role and safe duplicate/validation handling. |
| AC-13 | Initial-password reset requires a password change on next login and revokes old sessions without exposing the password. |
| AC-14 | Self-deactivation and removal or deactivation of the last active Administrator are prevented atomically. |
| AC-15 | All major Lab 3 screens remain usable and consistent at desktop, tablet, and mobile widths with visible focus and no clipping, overlap, or page-level horizontal overflow. |
| AC-16 | Unit, API/integration, UI, security/authorization, migration/regression, and E2E tests pass from final `main`, and every AC maps to planned and actual evidence. |

## 11. Definition of Done

### Product completion

- FR-01 through FR-21 and BR-01 through BR-30 are implemented without adding excluded scope.
- Authentication, session, CSRF, password, role, ownership, and safe-error behaviour match `api-spec.md`.
- Lab 2 data and Requester workflows remain valid after the reviewed migration.
- IT Staff Queue, Ticket Detail, assignment, priorities, statuses, comments, and notes satisfy the approved matrices.
- Administrator User Management satisfies one-role, deactivation, last-Administrator, and initial-password rules.
- Every AC has passing automated evidence recorded in `tests.md`; no required test is skipped or disabled.
- Zen Green desktop, tablet, and mobile inspection satisfies `ui-spec.md`.
- README, environment examples, migrations, seed instructions, and `.gitignore` are current and contain no real credentials.

### Course delivery completion

- The engineering contract and test plan exist before the main implementation Pull Requests are completed.
- Every increment is developed on its named feature branch and enters `lab3-staging` through peer-reviewed Pull Requests.
- Review feedback and responses are recorded in `docs/lab-03/reviewer.md`.
- Six to ten representative prompts and a personal reflection are recorded in `docs/lab-03/ai-use.md`.
- The integrated `lab3-staging` branch passes build, test, migration, seed, and E2E verification.
- The release Pull Request from `lab3-staging` to `main` is approved, merged, and used to collect the final report evidence.

## 12. Assumptions and Decisions

- Authentication uses an opaque server-side session rather than a JWT so logout, deactivation, password reset, and revocation are immediately enforceable.
- The browser stores only the opaque session ID in an `HttpOnly` cookie. It does not store authentication tokens in localStorage or sessionStorage.
- Administrators are explicitly permitted to use staff ticket operations by this authorization matrix; user administration remains a separate navigation area.
- Problem Appears Resolved is an auditable Requester indication, not a Ticket status transition.
- User-list pagination and advanced account recovery remain excluded.
