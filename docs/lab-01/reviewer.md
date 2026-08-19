# Lab 1 Peer Review Record

## Reviewer Information

| Item | Details |
| --- | --- |
| Author name | TODO: add your full name |
| Author student ID | TODO: add your student ID |
| Author GitHub username | `Ohmmykung09` |
| Peer reviewer name | TODO: add reviewer full name |
| Peer reviewer student ID | TODO: add reviewer student ID |
| Peer reviewer GitHub username | `MacOverlorD` |

## Pull Requests Reviewed by My Peer

| Issue | Branch | Pull Request | Review Result | Reviewer Feedback | My Response |
| --- | --- | --- | --- | --- | --- |
| Issue 1: Set up the TokTickIT project foundation | `feature/1-project-foundation` | TODO: paste PR #5 URL | Requested changes, then approved | The reviewer said the foundation was mostly well structured, but the compiled backend start command needed to work correctly after build. The reviewer also asked for a documented PostgreSQL connection check. | I fixed the backend build/start configuration, added `npm run db:check`, documented the database check, reran build/tests, and requested re-review. |
| Issue 2: Implement the API health check | `feature/2-health-check` | TODO: paste Issue 2 PR URL | Requested changes, then approved | The reviewer said the health endpoint, UI states, and tests were good, but `VITE_API_BASE_URL` was in the wrong environment file location for Vite. | I moved `VITE_API_BASE_URL` to `client/.env.example`, documented creating `client/.env`, reran tests/build, and requested re-review. |
| Issue 3: Create and seed IT request categories | `feature/3-category-seed` | TODO: paste Issue 3 PR URL | Approved | The reviewer approved the Prisma `Category` model, migration, and idempotent seed. | I verified the database connection, migration, seed, tests, and build before merging. |
| Issue 4: Display the IT request category list | `feature/4-category-list` | TODO: paste PR #8 URL | Requested changes, then approved | The reviewer said the category endpoint and UI worked, but asked for stronger UI tests proving categories were not hard-coded and covering category/database request failure. | I updated the success test to use custom API-returned category names and added a failure test where `/api/health` succeeds but `/api/categories` fails. I reran tests/build and requested re-review. |
| Lab 1 release | `lab1-staging` | TODO: paste release PR URL | TODO: approved after final review | TODO: summarize release PR review comment | TODO: summarize final response before merging into `main` |

## Pull Requests I Reviewed for My Peer

| Peer PR | Repository / Branch | My Review Result | My Review Comment | Peer Response |
| --- | --- | --- | --- | --- |
| TODO: paste peer PR URL | TODO: repository and branch | TODO: Approved or Requested changes | TODO: summarize the specific review comment you gave your peer | TODO: summarize how your peer responded |
| TODO: paste peer PR URL | TODO: repository and branch | TODO: Approved or Requested changes | TODO: summarize the specific review comment you gave your peer | TODO: summarize how your peer responded |

## Review Workflow Summary

All Lab 1 feature work was developed on feature branches and merged through Pull Requests into `lab1-staging`. I did not merge feature branches directly into `main`.

The workflow used for each Issue was:

1. Create or confirm the required GitHub Issue.
2. Move the Issue from `Backlog` to `Specified` after reading the requirements.
3. Move the Issue to `Started` when implementation began.
4. Work on the required feature branch.
5. Open a Pull Request from the feature branch into `lab1-staging`.
6. Move the Issue to `PR Review`.
7. If the reviewer requested changes, move the Issue to `Fixing`.
8. Push fixes to the same feature branch.
9. Request re-review.
10. Merge only after approval and passing verification.
11. Move the Issue to `Done`.

After Issues 1 to 4 were merged into `lab1-staging`, I opened a final release Pull Request from `lab1-staging` into `main`.

## Verification Evidence Summary

The following commands were used during Lab 1 verification:

```powershell
npm run db:check
npm run prisma:seed
npm test
npm run build
```

Manual browser verification was also performed by running the backend and frontend locally:

```powershell
npm run dev:server
npm run dev:client
```

The final browser demo showed:

- `System Status: Online`
- `Supported Request Categories`
- `Account and Access`
- `Hardware`
- `Software`
- `Network`

The failure case was verified by making the backend or database unavailable and confirming that the UI showed:

- `System Status: Offline`
- `Unable to connect to TokTickIT API.`
