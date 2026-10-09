# Lab 4 Release PR Draft

Use this draft only after the Issue #55 evidence PR is reviewed and merged into `lab4-staging`. The release PR must compare `lab4-staging` → `main`; do not retarget a feature PR directly to `main`.

## Suggested title

`release: integrate Lab 4 Actions Taken and dashboards`

## Suggested PR body

```markdown
## Summary
- Integrate the reviewed Lab 4 Actions Taken data model, API, lifecycle UI, and guarded Ticket resolution workflow.
- Add role-scoped Requester and IT Staff dashboards with exact metrics and drill-down filters.
- Include final regression, accessibility, responsive, performance, peer-review, and AI-use evidence.
- Deliver Lab 4 to `main` only through the reviewed `lab4-staging` integration branch.

## Included work
- Specification and Test DD: #47, #56 / PR #57
- Actions Taken migration and seed: #48 / PR #58
- Actions API and Ticket workflow: #49, #50 / PR #59
- Actions UI and dashboards: #51, #52, #53 / PR #60
- Regression and E2E hardening: #54 / PR #62
- Final evidence and release preparation: #55 / this PR

## Verification
- `npm run prisma:generate` — [result]
- `npm run test:quality:lab4` — [client/server/performance/build/E2E result]
- Responsive screenshots: desktop 1440x1000, tablet 820x1180, mobile 390x844.
- Accessibility: axe WCAG 2 A/AA and keyboard/name checks — [result]
- `git diff --check` — [result]
- Project board: all Lab 4 issues Done — [verification link]

## Review and release gate
- Peer-reviewed on `lab4-staging`; see `docs/lab-04/reviewer.md`.
- No direct feature-branch merge to `main`.
- Merge only after approval and successful checks on this exact release candidate.
```

## Commands after the evidence PR is merged

```powershell
git fetch origin
git switch lab4-staging
git pull --ff-only origin lab4-staging
npm ci
npm run prisma:generate
npm run test:quality:lab4
git diff --check
gh pr create --repo Ohmmykung09/toktickit --base main --head lab4-staging --title "release: integrate Lab 4 Actions Taken and dashboards" --body-file docs/lab-04/release-pr-body.md
```

The current branch's test results are recorded in `tests.md` only after running the gate here. Rerun the same gate after the evidence PR is merged; a pass on a pre-merge commit is not release-candidate evidence.

## Evidence index

- [Reviewer findings, responses, and approvals](reviewer.md)
- [Selected prompts and reflection](ai-use.md)
- [Test plan and final gate](tests.md)
- [Requester dashboard desktop screenshot](../../artifacts/lab-04/screenshots/dashboards/requester-dashboard-desktop.png)
- [Staff dashboard desktop screenshot](../../artifacts/lab-04/screenshots/dashboards/staff-dashboard-desktop.png)
- [Actions Taken desktop screenshot](../../artifacts/lab-04/screenshots/actions-taken/staff-ticket-actions-desktop.png)
- [Reopened Ticket desktop screenshot](../../artifacts/lab-04/screenshots/ticket-resolution/reopened-ticket-detail-desktop.png)
- [Project board snapshot showing all #48–#56 cards Done](../../artifacts/lab-04/screenshots/project-board-lab4.png)
- [Commit graph snapshot showing feature refs, `origin/lab4-staging`, and `origin/main`](../../artifacts/lab-04/screenshots/commit-history-lab4.png)
