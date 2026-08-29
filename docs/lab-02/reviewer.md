# Lab 2 Peer Review Record

## Reviewer Information

| Item | Details |
| --- | --- |
| Author name | TODO: add your full name |
| Author student ID | TODO: add your student ID |
| Author GitHub username | `Ohmmykung09` |
| Peer reviewer GitHub username | `alvin777777` |

## Pull Requests Reviewed by My Peer

| PR | Scope | Reviewer feedback | Response and outcome |
| --- | --- | --- | --- |
| [#17](https://github.com/Ohmmykung09/toktickit/pull/17) | Lab 2 specification and engineering contract | The reviewer noted that duplicate submission was described by `409 Conflict` but was only prevented in the frontend. | Added backend `Idempotency-Key` handling, documented `201`/`200`/`409` behaviour, and added API-07. The reviewer replied `Lgtm`. |
| [#18](https://github.com/Ohmmykung09/toktickit/pull/18) | Data model, seed, and lookups | The reviewer asked for exact active-list assertions rather than only `arrayContaining`. | Updated lookup tests to assert complete expected arrays for active related systems and Development Requesters. The reviewer confirmed the change. |
| [#19](https://github.com/Ohmmykung09/toktickit/pull/19) | Development Requester selection | The reviewer thought `checkSystem()` contained duplicate code in the diff. | Checked the final source and confirmed it contains one function, one categories request, and one `try/catch`; the apparent duplication was removed and added code shown together by GitHub. The reviewer approved the work. |
| [#20](https://github.com/Ohmmykung09/toktickit/pull/20) | Create Ticket | The reviewer could not see the Ticket Number implementation in the collapsed diff. | Pointed to `server/src/ticket-service.ts`, explained the serializable daily sequence, and referenced the API test that verifies its format. The reviewer approved the work. |
| [#21](https://github.com/Ohmmykung09/toktickit/pull/21) | My Tickets and Ticket Detail | The reviewer identified a possible `High` versus `HIGH` priority-filter mismatch. | Confirmed API normalization and added an integration test that sends the exact title-case UI value. The reviewer confirmed the result. |
| [#22](https://github.com/Ohmmykung09/toktickit/pull/22) | Attachments | The reviewer identified unsafe unconditional `response.json()` calls for `204 No Content` deletion and non-JSON upload errors. | Updated response handling, added regression tests for `204` and HTML `413`, and received confirmation. |

## Review Workflow Summary

Each implementation increment was developed on a feature branch, submitted through a Pull Request, and updated on the same branch when review feedback required a change. Review comments were treated as regression-test opportunities, not only as wording changes.

Before the final Lab 2 release, add the integration PR and release PR links here, including the reviewer approval and any final verification feedback.

## Final Review Checklist

- [ ] Add the integration PR URL that brings the approved stacked feature work into `lab2-staging`.
- [ ] Add the release PR URL from `lab2-staging` to `main`.
- [ ] Add reviewer full name and student ID when available.
- [ ] Record any final review comments and their resolution.
