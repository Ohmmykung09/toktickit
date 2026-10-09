# Lab 4 Peer Review Record

## Review Context

| Item | Details |
| --- | --- |
| Author | [`Ohmmykung09`](https://github.com/Ohmmykung09) |
| Reviewers | [`MacOverlorD`](https://github.com/MacOverlorD), [`alvin777777`](https://github.com/alvin777777) |
| Integration branch | `lab4-staging` |
| Evidence checked | GitHub PR review states, inline review threads, merge commits, and integrated branch history as of 2026-10-10 |

## Issue-to-PR Traceability

| Issue(s) | Pull request | Scope / result |
| --- | --- | --- |
| [#47](https://github.com/Ohmmykung09/toktickit/issues/47), [#56](https://github.com/Ohmmykung09/toktickit/issues/56) | [#57](https://github.com/Ohmmykung09/toktickit/pull/57) | Specification, API/UI contracts, and Test DD. #47 is the original specification issue; #56 is the duplicate tracked project card closed by the PR. |
| [#48](https://github.com/Ohmmykung09/toktickit/issues/48) | [#58](https://github.com/Ohmmykung09/toktickit/pull/58) | Actions Taken schema, migration, seed, and recovery evidence. |
| [#49](https://github.com/Ohmmykung09/toktickit/issues/49), [#50](https://github.com/Ohmmykung09/toktickit/issues/50) | [#59](https://github.com/Ohmmykung09/toktickit/pull/59) | Actions Taken API/authorization and Ticket workflow/resolution rules. |
| [#51](https://github.com/Ohmmykung09/toktickit/issues/51), [#52](https://github.com/Ohmmykung09/toktickit/issues/52), [#53](https://github.com/Ohmmykung09/toktickit/issues/53) | [#60](https://github.com/Ohmmykung09/toktickit/pull/60) | Actions Taken UI and Requester/Staff dashboards. |
| [#54](https://github.com/Ohmmykung09/toktickit/issues/54) | [#62](https://github.com/Ohmmykung09/toktickit/pull/62) | Integrated regression, cancellation/retry/CSRF coverage, isolated performance smoke, and deterministic responsive evidence. |
| [#55](https://github.com/Ohmmykung09/toktickit/issues/55) | This evidence/release-preparation PR | Final review record, AI-use reflection, evidence index, and release-PR draft. |

## Pull Request Review History

### PR #57 — Specification and Test DD

- Reviewer: MacOverlorD. First review requested changes on 2026-09-28; follow-up review approved on 2026-09-28 (“ok, Look great to me.”). Merged into `lab4-staging` on 2026-09-28.
- Findings: complete Action Taken lifecycle/assignment/audit model; backend-enforced current-cycle resolution gate; exact dashboard metric and timestamp contracts; database key/index/concurrency/recovery decisions; Test DD Expected Results, performance coverage, and recovery/repeat-seed tests.
- Response: updated `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` with the requested rules and traceability. The PR timeline contains an author summary of the changes. All six inline findings were followed by the approval; no final-main claim is made here.

### PR #58 — Actions Taken Data Foundation

- Reviewer: MacOverlorD. Changes requested and then approved on 2026-09-28 (“OK, wonderful work!”). Merged into `lab4-staging` on 2026-09-28.
- Findings: explicitly wrap the Prisma migration in a transaction; execute the actual migration in failure/recovery tests; use `Restrict`/`NoAction` to preserve append-only Action history; add a committed-failure restore rehearsal.
- Response: revised the migration/schema and recovery tests to exercise the real migration and documented restore path. The reviewer approved the revised PR. No separate author reply was present on the inline threads when checked.

### PR #59 — Actions API and Ticket Workflow

- Reviewer: MacOverlorD. Changes requested on 2026-09-28; approved on 2026-09-29 (“Look Good To ME!”). Merged into `lab4-staging` on 2026-09-29.
- Findings: duplicate Action POST retries needed idempotency; clearing optional attachment notes was rejected; a PATCH containing only `expectedVersion` mutated audit/version state instead of behaving as a no-op.
- Response: added duplicate-request handling, accepted the documented clear operation, and prevented no-op PATCH mutations. Approval followed the fixes. No separate author reply was present on the inline threads when checked.

### PR #60 — Actions UI and Dashboards

- Reviewer: alvin777777. Changes requested, then approved (“Look Good To ME!”) on 2026-10-08. Merged into `lab4-staging` on 2026-10-08.
- Findings (11 inline comments): preserve local date/time semantics; recover from stale-write conflicts; keep retry idempotent; restrict status transitions and confirm terminal actions; preserve load errors; show a loading state before dashboard data arrives; clear the selected ticket when returning to the queue; make metrics/status/priority drill-downs interactive; bound urgent-ticket queries; share the canonical action select shape; preserve a note when Follow-Up Required is unchecked.
- Response: addressed the behaviors in the UI/API/query paths and retained the follow-up-note value while hiding its field. Reviewer approval followed the revisions. No separate author reply was present on the inline threads when checked.

### PR #62 — Final Regression and E2E Hardening

- Reviewers: MacOverlorD and alvin777777. Both submitted changes-requested feedback on 2026-10-09; the PR later received approval and merged into `lab4-staging` on 2026-10-09.
- MacOverlorD findings (5): reset scroll before full-page capture; simulate a lost response after the API commits rather than a pre-request 503; prove cancellation and post-cancel immutability; remove flaky Prisma/client startup gates; use enough performance observations for a meaningful p95.
- alvin777777 findings (4): retain UNIT/AUTH/UI coverage in the final traceability table; keep the 10k/50k smoke out of the default server suite; scope the expected 409 assertion to the stale-write step; preserve a My Tickets dashboard drill-down after navigation.
- Response: corrected the capture helper and retry/cancel coverage, stabilized setup, expanded performance sampling, isolated the performance smoke, restored traceability rows, narrowed the conflict assertion, and fixed the My Tickets filter regression. No author reply was present on the inline threads when checked; the fixes are evidenced by the revised PR and approvals.

## Review Checklist

- [x] Link specification, implementation, regression, and evidence issues to their reviewed PRs (see traceability table).
- [x] Record reviewers, material findings, responses, approval outcomes, and merge destinations.
- [x] Keep review requests distinct from confirmed inline author replies; do not claim every comment received a posted reply.
- [x] Confirm PRs #57, #58, #59, #60, and #62 merged into `lab4-staging`.
- [ ] Merge the Issue #55 evidence PR into `lab4-staging` after peer review.
- [ ] Open and review the release PR from `lab4-staging` to `main`; rerun the final quality gate on the release candidate.

## Release Review Record

The release PR is prepared in [`release-pr.md`](release-pr.md) with a copy-ready body in [`release-pr-body.md`](release-pr-body.md). Project #2 was checked on 2026-10-10: all cards #48–#56 are Done, and the CLI-sourced snapshot is [`project-board-lab4.png`](../../artifacts/lab-04/screenshots/project-board-lab4.png). The commit graph snapshot is [`commit-history-lab4.png`](../../artifacts/lab-04/screenshots/commit-history-lab4.png). The release PR must not merge until this evidence PR is reviewed into `lab4-staging` and the complete test gate passes on the resulting release candidate. `main` receives Lab 4 only through that reviewed staging-to-main PR.
