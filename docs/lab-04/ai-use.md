# Lab 4 AI Use and Reflection

## AI Tool and Human Responsibility

I used Codex as a specification and review-response assistant for the Lab 4 engineering-contract increment. I remained responsible for choosing the scope, checking the repository and peer-review comments, comparing the contract with the Lab 4 handout, reviewing the diff, and deciding which evidence is still pending. This record preserves the initial specification-stage prompts and appends selected implementation-stage prompts; it is not a complete transcript.

## Specification Stage — PR #57

| Step | Selected prompt | Why I used it | Result | What I learned |
| --- | --- | --- | --- | --- |
| 1 | Read the repository and PR #57 review comments, then identify every requested contract correction before editing. | The review contained cross-document requirements that could be missed when handled independently. | Grouped feedback into lifecycle, resolution, dashboard, migration, and Test DD gaps. | Review comments work best as a traceable contract checklist, not isolated prose edits. |
| 2 | Define a complete Action Taken lifecycle with assignment, creator/performer audit distinction, completion/cancellation timestamps, inactive-assignee rejection, and optimistic concurrency. | The handout requires assign, status transition, complete, cancel, and inactive-assignee evidence. | Added the Action Taken state matrix, assignment rules, terminal behavior, and version semantics. | A parent-child work record needs its own lifecycle and authority model; Ticket ownership alone is not enough. |
| 3 | Make the Ticket resolution gate exact, atomic, and valid after reopening. | The backend must reject a direct API call that bypasses the normal screen. | Required a current-cycle completed Action with a non-empty result, an active owner, and a serializable transaction. | Reopening needs an explicit cycle boundary so an old completion cannot resolve a new cycle. |
| 4 | Replace ambiguous dashboard wording with exact counts, bounded lists, UTC boundaries, stable ordering, authoritative timestamps, and drill-down filters. | The handout requires every metric to have a query, empty behavior, and destination. | Synchronized the Requester and Staff dashboard contracts across specification, API, and UI docs. | A dashboard contract is testable only when the response shape and query boundary are unambiguous. |
| 5 | Add migration design decisions, backup/rollback/recovery procedure, legacy behavior, and repeat-safe seed rules without overwriting user-managed data. | The handout requires preservation of earlier data and tested migration recovery. | Added additive migration, index/key trade-offs, `fixtureKey`, restore rehearsal, and seed idempotency requirements. | Repeat-safe seed logic needs an immutable fixture identity instead of matching mutable display text. |
| 6 | Expand the Test DD table with an Expected Result for every row, explicit authorization coverage, rollback/recovery, repeat-seed, and performance-smoke evidence. | The handout's Test DD rubric requires traceability across quality dimensions. | Added expected outcomes, AUTH-01, MIG-03/04/05, PERF-01, and updated AC mappings. | Test IDs are useful only when each one states an observable result and maps to a real automated path. |

## Implementation and Release Stage — Selected Prompts

| Step | Selected prompt | Why I used it | Result | What I learned |
| --- | --- | --- | --- | --- |
| 7 | “#62 แก้ PR นี้ทีเดียวของ 2 คน Request มา และก็บอกด้วยว่าผมต้องตอบกลับพวกเขาแต่ละคนยังไง” | Resolve two reviewers' feedback while preserving which finding belonged to whom. | Mapped comments to code/test changes and prepared separate reviewer responses. | A code fix, an approval, and a posted reply are separate evidence; never report one as another. |
| 8 | “ทำ Issue สุดท้ายได้เลย” (Issue #55) | Complete review records, test evidence, and release preparation. | Prepared final evidence and a release flow that distinguishes staging results from future main/release results. | Evidence must identify the exact tested commit, working-tree state, command, and result. |

## Reflection

Codex was most useful for converting dense review feedback into implementation and test checklists, and for keeping related contract documents synchronized. The specification prompts made the original scope testable; the later review prompts helped identify where evidence or reviewer-state descriptions needed correction.

I remain responsible for reviewing the final diff and the actual GitHub review records. Test summaries do not replace a raw test log, and a test pass on staging does not prove the release candidate or `main` passed. Deferred review follow-ups are recorded as deferred rather than presented as completed work.
