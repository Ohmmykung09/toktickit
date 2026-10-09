# Lab 4 AI Use and Reflection

## AI Tool and Human Responsibility

I used Codex to inspect the repository and peer-review feedback, implement requested changes, and prepare test and release evidence. I chose the issues and PR scope, supplied the Lab 4 handout, reviewed the generated code and documentation, and remain responsible for checking test results and the final submission. The prompts below are selected from my implementation/review requests in this Lab 4 workflow; they are not a complete transcript.

## Selected Prompts

| Step | Prompt from the work | Why I used it | Result | What I learned |
| --- | --- | --- | --- | --- |
| 1 | “ทำ Issue 3 และ Issue 4 ได้เลย แล้วขอ commit push command” | Implement the Actions API and ticket workflow issues together and retain the planned PR sequence. | Delivered the two issue scopes through the reviewed Lab 4 branch flow. | Related requirements can share an implementation PR, but their acceptance criteria still need separate traceability. |
| 2 | “ทำ 3 issue นี้ Issue 5 + Issue 6 + Issue 7 ต่อได้เลย” | Continue with the staff Actions UI and both dashboards. | Implemented the grouped UI/dashboard scope and documented commands for review. | A UI change is incomplete until the loading, error, empty, navigation, and authorization states are checked too. |
| 3 | “#59 แก้ code ตาม PR นี้” | Address the next peer review against the integrated workflow. | Review feedback was translated into targeted fixes and regression tests before approval. | Review comments often reveal missing behavior at API boundaries, not just presentation issues. |
| 4 | “#60 แก้ตาม PR นี้” | Resolve dashboard/UI review feedback before integration. | Updated the Actions and dashboard behavior, then captured the approved result in the review record. | Reusing one validated data contract reduces drift between dashboard cards, lists, and drill-downs. |
| 5 | “เริ่มทำ issue ที่ 54 ได้เลย แล้วก็ขอ Command PR หน่อยถ้าเสร็จแล้ว” | Complete integrated regression and prepare the final feature PR. | Added regression/E2E hardening and collected passing test evidence for PR #62. | The release gate should be deterministic and should isolate expensive performance testing from ordinary suites. |
| 6 | “#62 แก้ PR นี้ทีเดียวของ 2 คน Request มา และก็บอกด้วยว่าผมต้องตอบกลับพวกเขาแต่ละคนยังไง” | Handle two reviewers' feedback as one coherent set without losing reviewer-specific context. | Mapped each comment to a code/test change and prepared reviewer-specific response language. | A change log should distinguish a code fix from an actual posted reply; one does not prove the other. |
| 7 | “ทำ Issue สุดท้ายได้เลย” (Issue #55) | Finish peer-review records, AI-use reflection, final evidence, and release preparation. | This PR adds the evidence index, review timeline, release draft, and links to collected Lab 4 screenshots. | Final evidence must be gathered from the exact integrated commit and must not imply that an unmerged release is already verified. |
| 8 | “ลองเช็คดูเผื่อต้องแก้” with the Lab 4 handout attached | Keep implementation and test evidence aligned with the course requirements. | Compared the issue and test plan with the provided Lab 4 requirements before finalizing the release checklist. | External rubric requirements should be checked explicitly rather than inferred from passing tests alone. |

## Reflection

Codex was most useful for turning dense review feedback into a requirement-by-requirement implementation and test checklist, and for keeping linked documents synchronized. The strongest results came when I supplied the exact issue/PR and asked for concrete tests or commands. Peer review improved the work by surfacing retry idempotency, real migration recovery, authorization, accessible conflict handling, responsive evidence, and dashboard navigation regressions.

I still need to inspect the final diff and the GitHub PR before merging. Passing tests show the behavior covered by those tests; they do not replace a human review of the code, the rendered documentation, or the release branch. In particular, the release PR must be tested again after the Issue #55 evidence PR is merged into `lab4-staging`.
