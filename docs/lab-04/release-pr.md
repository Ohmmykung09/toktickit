# Lab 4 Release PR Preparation

Use this procedure only after the Issue #55 evidence PR (#63) is reviewed and merged into `lab4-staging`. The release PR must compare `lab4-staging` → `main`; do not retarget a feature PR directly to `main`.

## Release candidate quality gate

Run these commands from the repository root in PowerShell. Native executables such as `git`, `npm`, and `gh` report failures through `$LASTEXITCODE`; `$ErrorActionPreference = 'Stop'` does not stop the script for those failures. Each command below therefore checks its exit code explicitly. Do not run `gh pr create` unless every prerequisite and the complete gate pass.

```powershell
$ErrorActionPreference = 'Stop'

git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed; release PR was not created.' }
git switch lab4-staging
if ($LASTEXITCODE -ne 0) { throw 'Could not switch to lab4-staging; release PR was not created.' }
git pull --ff-only origin lab4-staging
if ($LASTEXITCODE -ne 0) { throw 'Could not fast-forward lab4-staging; release PR was not created.' }

$releaseSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not capture release candidate SHA.' }
$dirty = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect working tree.' }
if ($dirty) { throw 'Working tree is not clean; do not claim release-candidate evidence.' }

npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; release PR was not created.' }
npm run prisma:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma generate failed; release PR was not created.' }

$runId = [DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmssZ')
$log = "artifacts/lab-04/test-runs/quality-gate-release-$runId.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
$started = [DateTimeOffset]::UtcNow
@("Release candidate SHA: $releaseSha", 'Working tree before gate: clean', 'Command: npm run test:quality:lab4', "Started UTC: $($started.ToString('o'))", '') | Set-Content -LiteralPath $log
npm run test:quality:lab4 2>&1 | Tee-Object -FilePath $log -Append
$gateExit = $LASTEXITCODE
$finished = [DateTimeOffset]::UtcNow
@('', "Finished UTC: $($finished.ToString('o'))", "Exit code: $gateExit") | Add-Content -LiteralPath $log
if ($gateExit -ne 0) { throw "Quality gate failed with exit code $gateExit; release PR was not created. See $log" }

git diff --check
if ($LASTEXITCODE -ne 0) { throw 'git diff --check failed; release PR was not created.' }

# Fill the placeholders in release-pr-body.md with this run's SHA, log path,
# timestamps, and results. Refuse to create a PR while any placeholder remains.
if (Select-String -LiteralPath 'docs/lab-04/release-pr-body.md' -Pattern '\[FILL IN') {
  throw 'Complete the release PR body placeholders before creating the PR.'
}

gh pr create --repo Ohmmykung09/toktickit --draft --base main --head lab4-staging --title 'release: integrate Lab 4 Actions Taken and dashboards' --body-file docs/lab-04/release-pr-body.md
if ($LASTEXITCODE -ne 0) { throw 'gh pr create failed.' }
```

The gate log must be committed or otherwise linked as an artifact on the release PR, and the PR body must identify the exact tested SHA, clean-tree status, command, UTC start/end, exit code, and test results. The run above is the release-candidate gate; results from PR #63 or an earlier staging commit are not substitutes.

## Single-source PR body

[`release-pr-body.md`](release-pr-body.md) is the only release PR body source. Fill in its verification fields after the exact candidate passes. Do not keep a second copy of the body in this instruction file.

## Evidence index

- [Reviewer findings, responses, and approvals](reviewer.md)
- [Selected prompts and reflection](ai-use.md)
- [Test plan and evidence for this PR](tests.md)
- [Requester dashboard desktop screenshot](../../artifacts/lab-04/screenshots/dashboards/requester-dashboard-desktop.png)
- [Staff dashboard desktop screenshot](../../artifacts/lab-04/screenshots/dashboards/staff-dashboard-desktop.png)
- [Actions Taken desktop screenshot](../../artifacts/lab-04/screenshots/actions-taken/staff-ticket-actions-desktop.png)
- [Reopened Ticket desktop screenshot](../../artifacts/lab-04/screenshots/ticket-resolution/reopened-ticket-detail-desktop.png)
- [Project board snapshot showing all #48–#56 cards Done](../../artifacts/lab-04/screenshots/project-board-lab4.png)
- [Commit graph snapshot showing feature refs, `origin/lab4-staging`, and `origin/main`](../../artifacts/lab-04/screenshots/commit-history-lab4.png)
