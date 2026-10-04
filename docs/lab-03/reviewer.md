# Lab 3 Peer Review Record

## Reviewer Information

| Item | Details |
| --- | --- |
| Author GitHub username | [`Ohmmykung09`](https://github.com/Ohmmykung09) |
| Primary peer reviewer | [`MacOverlorD`](https://github.com/MacOverlorD) |
| Review method | GitHub Pull Request review on each Lab 3 increment |
| Integration branch | `lab3-staging` |

## Pull Request Review History

| PR | Scope | Main review feedback | Response and outcome |
| --- | --- | --- | --- |
| [#36](https://github.com/Ohmmykung09/toktickit/pull/36) | Sprint 3 engineering contract | The specification, API/UI contracts, security rules, test plan, and traceability were reviewed for consistency. | The reviewer approved the contract before the main implementation increments were completed. |
| [#37](https://github.com/Ohmmykung09/toktickit/pull/37) | User migration and seed foundation | The reviewer identified repeat-seed data loss, a committed default credential, an unsafe password migration, incomplete canonical-email enforcement, shared-database migration tests, missing Lab 3 schema concepts, and inconsistent password boundaries. | Seed reruns were changed to preserve managed data, credentials became explicit local-only configuration, Argon2id and unprovisioned accounts were introduced, isolated migration tests were added, the full Lab 3 schema was completed, and the reviewer replied `LGTM`. |
| [#38](https://github.com/Ohmmykung09/toktickit/pull/38) | Authentication and mandatory password change | Protected APIs admitted missing sessions, failed-login accounting was not concurrency-safe, and login could publish a stale session during a concurrent password change. | Added deny-by-default protection, transactional login-attempt handling, credential/session concurrency guards, and integration regressions. The second review approved the PR. |
| [#39](https://github.com/Ohmmykung09/toktickit/pull/39) | Authorization and Requester regression | Cross-requester attachment upload, download, and delete were not tested, and existing sessions were not proven invalid after role or activation changes. | Added ownership-safe attachment regressions and current-user role/activation revalidation tests. The reviewer approved the revised PR. |
| [#40](https://github.com/Ohmmykung09/toktickit/pull/40) | IT Staff Ticket Queue | The reviewer requested complete API coverage for search, filters, AND semantics, ownership scopes, sorting, pagination, invalid queries, and forbidden access, plus UI failure, responsive, and role-boundary evidence. | Expanded API/UI tests, added narrow-viewport browser evidence, and proved requester-only actions remain hidden. The reviewer approved the revision. |
| [#41](https://github.com/Ohmmykung09/toktickit/pull/41) | IT Staff Ticket operations | Attachment continuity was missing from Staff Detail; optimistic updates lacked deterministic race tests; status/owner rules and public/private history needed stronger coverage. | Added attachment metadata/download behavior, stale-writer race tests, full status-transition coverage, owner-required tests, and Public Comment/Internal Note isolation evidence. The reviewer approved the revision. |
| [#42](https://github.com/Ohmmykung09/toktickit/pull/42) | Administrator User Management | The last-active-Administrator rule was not atomic, deactivated or demoted owners remained assigned, and session, email, password, and CSRF regressions were incomplete. | Added serializable safety checks, atomic owner reconciliation, session revocation, canonical-email and password validation, and concurrent PostgreSQL tests. The reviewer approved the revision. |
| [#43](https://github.com/Ohmmykung09/toktickit/pull/43) | Public Comments and Internal Notes | The reviewer found write-time authorization races, duplicate risk after a lost response, and Unicode boundary/surrogate validation gaps. | Added transactional actor revalidation, idempotent response-loss reconciliation, Unicode code-point policy, and deterministic regressions. The final review approved the PR. |
| [#44](https://github.com/Ohmmykung09/toktickit/pull/44) | Quality evidence and responsive E2E | The isolated E2E run could reuse an unrelated server, assignment eligibility could change before mutation, and Admin create/update/reset trusted stale authority. | Disabled server reuse for isolated quality runs, locked and revalidated assignment owners, revalidated the acting Administrator inside every mutation transaction, and added paused-request regressions. The final review approved the PR. |

## Review Workflow

Each change request was addressed on the same feature branch. The response described the behavioral change and the new regression evidence, then the same PR was returned for review. Feature PRs entered their approved stacked branch or `lab3-staging`; they did not enter `main` directly.

Review comments were treated as test cases. Concurrency, authorization, migration, response-loss, Unicode, and isolation concerns were converted into executable regressions so later changes cannot silently restore the same defects.

## Integration and Release Record

- PR #43 was approved and merged into `feature/lab3-6-ticket-operations`, then included in the integrated quality branch.
- PR #44 was approved and merged into `lab3-staging` with the complete quality suite and responsive evidence.
- Issue #35 prepares this review record, AI reflection, repository guidance, and final release evidence.
- The release PR must use `lab3-staging` as its head and `main` as its base after Issue #35 is approved.
- The complete quality command must be rerun from final `main`, and its output must be captured for the submitted PDF.

## Final Review Checklist

- [x] Every Lab 3 implementation increment has a linked Pull Request.
- [x] Material review comments and the corresponding corrections are recorded.
- [x] PR #36 through PR #44 reached an accepted review outcome and were merged into the approved branch flow.
- [x] Review-driven security and concurrency changes have automated regression coverage.
- [x] The integrated `lab3-staging` tree contains the approved Lab 3 increments.
- [ ] Add the final release PR URL and approval to the submitted PDF after `lab3-staging` is reviewed into `main`.
- [ ] Capture the passing final-main quality output, the 1440 x 1000, 820 x 1180, and 390 x 844 responsive evidence, and the commit graph after the release merge.
