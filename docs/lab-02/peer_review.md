# Lab 2 Peer Reviews Performed

## Reviewer Information

| Item | Details |
| --- | --- |
| Reviewer GitHub username | `Ohmmykung09` |
| Repository reviewed | [`MacOverlorD/toktickit`](https://github.com/MacOverlorD/toktickit) |
| Review period | September 2026 |

## Pull Request Review Summary

| Pull Request | Scope | Review summary | Response and outcome |
| --- | --- | --- | --- |
| [#23](https://github.com/MacOverlorD/toktickit/pull/23) | Development Requester context | Requested safer handling when `sessionStorage` writes fail, strict mapping to the public requester response shape, updated review evidence, and clarification of where requester middleware would be applied. | The author added separate persistence-error handling, removed stale stored values, mapped responses to `{ id, name, email }`, added regression tests, and documented the deferred middleware integration. I re-reviewed and approved the PR. |
| [#24](https://github.com/MacOverlorD/toktickit/pull/24) | Create Ticket workflow | Identified correctness gaps in idempotent retries, navigation during submission, malformed JSON error handling, and validation of server-provided `fieldErrors`. | The author made retries deterministic, blocked exit paths while submitting, returned safe `400 VALIDATION_ERROR` responses, restricted client field errors to known fields, and added focused tests. I re-reviewed and approved the PR. |
| [#25](https://github.com/MacOverlorD/toktickit/pull/25) | My Tickets | Requested protection against stale Retry responses, database-range validation for numeric query values, explicit reference-loading failure handling, and support for inactive historical references without data leakage. | The author unified the request lifecycle, added range checks, returned filter metadata with the requester-scoped list, supported historical references safely, and added regression tests. I re-reviewed and approved the PR. |
| [#26](https://github.com/MacOverlorD/toktickit/pull/26) | Requester Ticket Detail | Verified requester ownership enforcement, safe not-found behavior, allowlisted API fields, ordered attachment metadata, responsive read-only UI, and the related API/UI tests. No blocking issue was found. | I approved the PR after confirming that the implementation and tests satisfied the Issue and API contract. |
| [#27](https://github.com/MacOverlorD/toktickit/pull/27) | Attachment lifecycle | Requested fixes for preview windows opened after an asynchronous request, oversized JSON returning the wrong error contract, and missing regression evidence for database-failure cleanup. | The author preserved user activation for previews, handled blocked pop-ups and loading failures, returned `413 PAYLOAD_TOO_LARGE`, and tested storage/database compensation. I re-reviewed and approved the PR. |
| [#28](https://github.com/MacOverlorD/toktickit/pull/28) | E2E and release readiness | Requested stronger E2E proof that a new ticket is found through My Tickets, non-destructive seed setup, isolated test servers, corrected visual evidence, visible cleanup failures, and separation between runtime screenshots and approved evidence. | The author addressed all six points, reran the build and complete test suites, and reported 114 server tests, 95 client tests, and 7 Playwright tests passing. I re-reviewed the changes as `LGTM`; the PR was subsequently completed and merged. |

## Review Reflection

These reviews focused on observable behaviour, API contracts, ownership boundaries, failure handling, and regression evidence rather than code style alone. When an issue was found, I described its user or system impact and requested a focused test with the fix. Re-reviewing the updated commits confirmed that each blocking concern had been resolved before the work entered the staging branch.
