# Lab 4 AI Use and Reflection

## AI Tool Used

I used Codex as a specification and review-response assistant for the Lab 4 engineering-contract increment. I remained responsible for choosing the scope, checking the repository and peer-review comments, comparing the contract with the Lab 4 handout, reviewing the diff, and deciding which evidence is still pending. This record is the initial specification-stage record and must be extended with implementation-stage prompts before the final submission.

## Selected Key Prompts

| Step | Selected prompt | Why I used it | Result | What I learned |
| --- | --- | --- | --- | --- |
| 1 | Read the repository and PR #57 review comments, then identify every requested contract correction before editing. | The review contained multiple cross-document requirements that could be missed when handled independently. | Grouped the feedback into lifecycle, resolution, dashboard, migration, and Test DD gaps. | Review comments are best treated as a contract checklist rather than isolated prose changes. |
| 2 | Define a complete Action Taken lifecycle with assignment, creator/performer audit distinction, completion/cancellation timestamps, inactive-assignee rejection, and optimistic concurrency. | The handout requires assign, status transition, complete, cancel, and inactive-assignee evidence. | Added the Action Taken state matrix, assignment rules, terminal behavior, and version semantics. | A parent-child work record needs its own lifecycle and authority model; Ticket ownership alone is not enough. |
| 3 | Make the Ticket resolution gate exact, atomic, and valid after reopening. | The backend must reject a direct API call that bypasses the normal screen. | Required a current-cycle completed Action with a non-empty result, an active owner, and a serializable transaction. | Reopening needs an explicit cycle boundary so an old completion cannot resolve a new cycle. |
| 4 | Replace ambiguous dashboard wording with exact counts, bounded lists, UTC boundaries, stable ordering, authoritative timestamps, and drill-down filters. | The handout requires every metric to have a query, empty behavior, and destination. | Synchronized the Requester and Staff dashboard contracts across specification, API, and UI docs. | A dashboard contract is testable only when the response shape and query boundary are unambiguous. |
| 5 | Add migration design decisions, backup/rollback/recovery procedure, legacy behavior, and repeat-safe seed rules without overwriting user-managed data. | The handout requires preservation of earlier data and tested migration recovery. | Added additive migration, index/key trade-offs, `fixtureKey`, restore rehearsal, and seed idempotency requirements. | Repeat-safe seed logic needs an immutable fixture identity instead of matching mutable display text. |
| 6 | Expand the Test DD table with an Expected Result for every row, explicit authorization coverage, rollback/recovery, repeat-seed, and performance-smoke evidence. | The handout's Test DD rubric requires traceability across all quality dimensions. | Added expected outcomes, AUTH-01, MIG-03/04/05, PERF-01, and updated AC mappings. | Test IDs are useful only when each one states an observable result and maps to a real automated path. |

## My Reflection

The specification agent was most useful when the prompt named the handout requirement, the security boundary, the observable result, and the document set that had to remain synchronized. Peer review exposed assumptions that were not safe to leave to implementation, especially the resolution gate, reopened cycles, dashboard timestamps, and migration recovery.

The current record covers the specification-stage work only. During later Lab 4 implementation and release increments, I will append the prompts used for Prisma migration, REST APIs, UI behavior, regression, accessibility, visual evidence, and final hardening. I will also record the actual test commands and final-main evidence rather than claiming them in advance.

