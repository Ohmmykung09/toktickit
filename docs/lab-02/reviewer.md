# Lab 2 Peer Review Record

## Reviewer Information

| Item                           | Details                      |
| ------------------------------ | ---------------------------- |
| Author name                    |                              |
| Author student ID              |                              |
| Author GitHub username         | `Ohmmykung09`                |
| Peer reviewer GitHub usernames | `alvin777777`, `MacOverlorD` |

## Pull Requests Reviewed by My Peer

| PR                                                      | Scope                                                      | Reviewer feedback                                                                                                                                                                                                               | Response and outcome                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#17](https://github.com/Ohmmykung09/toktickit/pull/17) | Lab 2 specification and engineering contract               | The reviewer noted that duplicate submission was described by `409 Conflict` but was only prevented in the frontend.                                                                                                            | Added backend `Idempotency-Key` handling, documented `201`/`200`/`409` behaviour, and added API-07. The reviewer replied `Lgtm`.                                                                                                                                                                         |
| [#18](https://github.com/Ohmmykung09/toktickit/pull/18) | Data model, seed, and lookups                              | The reviewer asked for exact active-list assertions rather than only `arrayContaining`.                                                                                                                                         | Updated lookup tests to assert complete expected arrays for active related systems and Development Requesters. The reviewer confirmed the change.                                                                                                                                                        |
| [#19](https://github.com/Ohmmykung09/toktickit/pull/19) | Development Requester selection                            | The reviewer thought `checkSystem()` contained duplicate code in the diff.                                                                                                                                                      | Checked the final source and confirmed it contains one function, one categories request, and one `try/catch`; the apparent duplication was removed and added code shown together by GitHub. The reviewer approved the work.                                                                              |
| [#20](https://github.com/Ohmmykung09/toktickit/pull/20) | Create Ticket                                              | The reviewer could not see the Ticket Number implementation in the collapsed diff.                                                                                                                                              | Pointed to `server/src/ticket-service.ts`, explained the serializable daily sequence, and referenced the API test that verifies its format. The reviewer approved the work.                                                                                                                              |
| [#21](https://github.com/Ohmmykung09/toktickit/pull/21) | My Tickets and Ticket Detail                               | The reviewer identified a possible `High` versus `HIGH` priority-filter mismatch.                                                                                                                                               | Confirmed API normalization and added an integration test that sends the exact title-case UI value. The reviewer confirmed the result.                                                                                                                                                                   |
| [#22](https://github.com/Ohmmykung09/toktickit/pull/22) | Attachments                                                | The reviewer identified unsafe unconditional `response.json()` calls for `204 No Content` deletion and non-JSON upload errors.                                                                                                  | Updated response handling, added regression tests for `204` and HTML `413`, and received confirmation.                                                                                                                                                                                                   |
| [#23](https://github.com/Ohmmykung09/toktickit/pull/23) | Lab 2 quality evidence and integration into `lab2-staging` | The final review requested category and sort-direction controls, optional attachments during ticket creation, requester-scoped idempotency, auditable soft removal, stricter list tests, and a public-only attachment response. | Implemented every requested change, added a database migration and regression coverage, and verified 20 client tests, 19 server tests, one browser E2E test, and the production build. `MacOverlorD` completed the final review with `LGTM`, approved the PR, and PR #23 was merged into `lab2-staging`. |

## Review Workflow Summary

Each implementation increment was developed on a feature branch, submitted through a Pull Request, and updated on the same branch when review feedback required a change. Review comments were treated as regression-test opportunities, not only as wording changes.

## Final Integration and Release Review

### Integration PR #23

- URL: https://github.com/Ohmmykung09/toktickit/pull/23
- Result: Approved and merged into `lab2-staging`.
- Initial review result: Changes requested because several Lab 2 requirements needed stronger implementation and test evidence.
- Resolution: Added the missing My Tickets filters and sort direction, Create Ticket attachments, requester-scoped idempotency, removal reasons with retained metadata, safe public attachment responses, and expanded API/UI/E2E tests.
- Final review result: `MacOverlorD` reviewed commit `666b601` on 2 September 2026, replied `LGTM`, and approved the Pull Request.

### Release PR

- URL: https://github.com/Ohmmykung09/toktickit/pull/24
- Result: Pending peer review and merge into `main`.
- Required final verification: Run the complete automated tests, production build, and Playwright requester-ticket flow on the integrated branch before merge.

## Final Review Checklist

- [x] Add the integration PR URL that brings the approved stacked feature work into `lab2-staging`.
- [x] Add the release PR URL from `lab2-staging` to `main`.
- [ ] Add reviewer full name and student ID when available.
- [x] Record any final review comments and their resolution.
