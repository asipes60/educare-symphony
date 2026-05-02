# EduCare Symphony

Orchestration service for EduCare LLC. Polls Command Center Tasks every 15 minutes, dispatches eligible tasks to the appropriate Claude-powered skill, routes deliverables to the correct destination (Airtable record, Google Drive folder, or both), and holds outputs in `Awaiting Review` status until human approval at the destination record.

## Architecture

| Layer | Module | Responsibility |
|---|---|---|
| Policy | `WORKFLOW.md` | Runtime config, skill destinations, identities, guardrails |
| Config | `src/config/` | Workflow loader, secret resolver, types |
| Integration | `src/airtable/` `src/deliverable/drive.ts` | Multi-base Airtable client, Drive uploader |
| Orchestration | `src/orchestrator/` | Tick loop, eligibility filter, task lifecycle |
| Execution | `src/runner/` | Workspace manager, prompt builder, Claude API caller |
| Deliverable | `src/deliverable/` | Field map resolver, write handler |
| Observability | `src/logging/` | Structured stdout logger, Run Log writer |

## Block 6 Scope (Current)

- Dispatch and skill routing
- Single-task lifecycle (workspace, prompt, Claude call, deliverable write)
- Run Log entries per attempt
- Status transitions (Ready → In progress → Awaiting Review or Failed)

## Block 8 Scope (Deferred)

- Retry logic with exponential backoff
- Reconciliation for stalled tasks
- Concurrent task execution within concurrency limits

## Block 8 Scope (Shipped)

- Approval Watcher — polls destination records each tick, transitions Tasks to `Done` on approval and back to `Ready` on rejection. Read-mostly: writes only to Tasks and Run Log, never to destination records.

## Setup

### Prerequisites

- Node.js 20+
- GCP project with Workload Identity Federation configured (see project docs)
- Airtable PAT scoped to all six Symphony bases
- Anthropic API key
- Google Drive service account JSON (for `airtable_plus_drive` and `drive_only` shapes)

### Local Development

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in real values
3. Set `SYMPHONY_ENV=local` to skip GCP Secret Manager and read directly from `.env`
4. Install dependencies: `npm install`
5. Validate workflow: `npm run validate`
6. Run a single tick: `npm run tick`

### Production (GitHub Actions)

The `.github/workflows/tick.yml` workflow runs every 15 minutes via cron. It authenticates to GCP via Workload Identity Federation, pulls secrets from Secret Manager at job start, and runs `npm run tick`.

Required GitHub Actions secrets:

| Secret | Value |
|---|---|
| `WIF_PROVIDER` | Full WIF provider resource path |
| `WIF_SERVICE_ACCOUNT` | Service account email |
| `GCP_PROJECT_ID` | `educare-symphony` |
| `GCP_PROJECT_NUMBER` | Numeric project number |

Required GCP Secret Manager secrets:

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `AIRTABLE_API_KEY` | Airtable PAT |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | Drive service account JSON |

## Skills

The `skills/` directory contains a `SKILL.md` for each registered skill. Block 6 ships with stub files; the real skill content must be synced from the canonical EduCare skills directory before live dispatch produces meaningful output.

To sync a skill: copy the SKILL.md from the canonical source into `skills/<skill-name>/SKILL.md`.

## Adding a New Skill

1. Add the skill folder to `skills/` with a SKILL.md
2. Add a `destinations` entry in WORKFLOW.md with shape, base/table IDs, write mode, status field config, and field map
3. Add the skill name as a `Skill` field option in the Tasks table
4. Update the intake skill's known-skills list
5. Commit and push. Next tick picks it up.

## Operating

### Pausing the orchestrator

Disable the GitHub Actions workflow at Settings → Actions → Workflows → Symphony Tick → Disable.

### Triaging a failed task

1. Open the task in Airtable. Read `Last error` and `Last run ended`.
2. Open Run Log filtered to that task. Review attempt history.
3. Check the destination record (from `Destination record ID`) to see if a partial deliverable was written.
4. Decide: edit the task and reset to `Ready`, or archive it.

### Promoting NBCC ACEP to approved

When NBCC sends written confirmation:

1. Edit `WORKFLOW.md`: change `guardrails.nbcc_acep_status` from `pending` to `approved`
2. Commit and push
3. Next tick picks up the new policy. NBCC content will then be permitted to claim approved status.

## License

Proprietary. EduCare LLC.
