# Lab 4 Screenshot Provenance

This inventory distinguishes the evidence currently checked in from the later PR #63 gate attempt. The failed gate did not start Playwright and did not regenerate browser screenshots.

| Capture group | Files | Source revision / provenance |
| --- | --- | --- |
| Actions Taken responsive captures | `screenshots/actions-taken/*` | Refreshed in PR #63 evidence commit `0bcb81c063c97d0d860c4ac80fc8d7a0c7812a9e`. The commit has no associated raw capture log, so a precise execution timestamp cannot be established from the repository. |
| Requester dashboard captures | `screenshots/dashboards/requester-dashboard-*` | Refreshed in PR #63 evidence commit `0bcb81c063c97d0d860c4ac80fc8d7a0c7812a9e`; no raw capture log was committed with that revision. |
| Staff dashboard captures | `screenshots/dashboards/staff-dashboard-*` | The mobile viewport file was unchanged from `f8955d5416ed63a776f477ff18ec1e6c5e176f84` (2026-10-09 23:42:42 +07:00). Other files in this group changed in PR #63 evidence commit `0bcb81c063c97d0d860c4ac80fc8d7a0c7812a9e`. No raw capture log was committed for either source revision. |
| Ticket resolution captures | `screenshots/ticket-resolution/*` | The mobile viewport file was unchanged from `f8955d5416ed63a776f477ff18ec1e6c5e176f84` (2026-10-09 23:42:42 +07:00). Other files in this group changed in PR #63 evidence commit `0bcb81c063c97d0d860c4ac80fc8d7a0c7812a9e`. No raw capture log was committed for either source revision. |
| Project board / commit graph | `project-board-lab4.png`, `commit-history-lab4.png` | Rendered by `npm run evidence:lab4` during this PR #63 revision on 2026-10-10; sourced from GitHub CLI Project #2 and the local Git graph. |

The new quality-gate attempt recorded in [`test-runs/quality-gate-pr63-20261010.log`](test-runs/quality-gate-pr63-20261010.log) stopped before Playwright because another local app occupied port 3000. It must not be attributed as the source run for any browser screenshot. Rerun Playwright after the port is available and replace/refresh the capture groups so all viewport evidence can be tied to one logged run.
