---
tracker:
  kind: airtable
  base_id: appnw60PZmruBD81U
  tasks_table_id: tblShDc3vpr23icRe
  run_log_table_id: tblVZevifbtLu3dbU
  api_key: $AIRTABLE_API_KEY
  active_states: ["Ready"]
  terminal_states: ["Done", "Failed", "Archived"]
  required_dispatch_mode: Symphony
polling:
  interval_ms: 900000
agent:
  max_concurrent_agents: 3
  max_concurrent_agents_by_track:
    NBCC: 2
    BACB: 2
    Ops: 2
    Code: 0
  max_attempts: 3
  request_timeout_ms: 600000
claude:
  api_endpoint: https://api.anthropic.com/v1/messages
  model: claude-sonnet-4-5-20250929
  api_key: $ANTHROPIC_API_KEY
  max_tokens: 16000
workspace:
  root: ./.symphony/workspaces
  cleanup_on_success: true
  cleanup_on_failure: false
deliverables:
  drive_root_folder_id: 16cbCkLV3uWgR6KtIhncQd6CHEt3KRlO1
  drive_service_account_env: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
identities:
  NBCC:
    name: Adam Sipes
    credentials: M.A., PPS, LPCC
    voice: nbcc
  BACB:
    name: Marissa Butcher
    credentials: M.S., AMFT, BCBA
    voice: bacb
  Ops:
    name: EduCare Ops
    credentials: ""
    voice: ops
  Code:
    name: EduCare Ops
    credentials: ""
    voice: ops
guardrails:
  nbcc_acep_status: pending
  nbcc_acep_submitted_date: "2026-03-31"
  bacb_ace_provider_id: OP-26-12340
  bacb_ace_status: approved
destinations:
  educare-linkedin-poster:
    shape: airtable_only
    base_id: apphMrUMSEexbApjo
    table_id: tbl1uXcLNIXXhjI3Z
    write_mode: create
    initial_status_field: Status
    initial_status_value: Draft
    approval_status_value: Ready to Post
    field_map:
      LinkedIn Draft: $output.body
      Content Pillar: $task.content_pillar
      Platform: LinkedIn
      Draft Created Date: $now
      Notes: $output.notes
  educare-blog-writer:
    shape: airtable_only
    base_id: app5ywucMzgw1vUDV
    table_id: tblFewuA7Dfm5ygZQ
    write_mode: create
    initial_status_field: Status
    initial_status_value: Draft
    approval_status_value: Approved
    field_map:
      Post Title: $output.title
      Body: $output.body
      Slug: $output.slug
      Meta Description: $output.meta_description
      Target Keyword: $output.target_keyword
      Content Pillar: $task.content_pillar
      Sources: $output.sources
      Word Count: $output.word_count
      Generated Date: $now
  nbcc-course-creator:
    shape: airtable_plus_drive
    base_id: appO2kARkHl4yyKDm
    table_id: tbl2K0iXfxXeExGNl
    write_mode: create
    initial_status_field: Status
    initial_status_value: Pending Confirmation
    approval_status_value: Confirmed
    drive_subfolder_id: 10V8MACGNj4g7Yp3R-pi2LiuUK2aIuEpr
    field_map:
      Course Title: $output.title
      Program Descriptions: $output.program_description
      Learning Objectives: $output.learning_objectives
      NBCC Content Area: $output.nbcc_content_area
      Clock Hours: $output.clock_hours
      Target Audience: $output.target_audience
      Presenter Category: $output.presenter_category
      Total Word Count: $output.word_count
      Ethics Flag: $output.ethics_flag
      Date Created: $now
      Google Drive Folder: $deliverable.drive_url
  bcba-course-creator:
    shape: airtable_plus_drive
    base_id: appO2kARkHl4yyKDm
    table_id: tbl4mR0nj4RjYsqe1
    write_mode: create
    initial_status_field: Status
    initial_status_value: Pending Confirmation
    approval_status_value: Confirmed
    drive_subfolder_id: 10V8MACGNj4g7Yp3R-pi2LiuUK2aIuEpr
    field_map:
      Course Title: $output.title
      Program Description: $output.program_description
      Learning Objectives: $output.learning_objectives
      CEU Category: $output.ceu_category
      CEU Value: $output.ceu_value
      Instructional Time: $output.instructional_time_minutes
      Target Audience: $output.target_audience
      Total Word Count: $output.word_count
      Ethics Flag: $output.ethics_flag
      Supervision Flag: $output.supervision_flag
      Instructor: "Marissa Butcher, M.S., AMFT, BCBA"
      Date Created: $now
      Google Drive Folder: $deliverable.drive_url
  educare-nbcc-course-auditor:
    shape: airtable_plus_drive
    base_id: appO2kARkHl4yyKDm
    table_id: tbl2K0iXfxXeExGNl
    write_mode: update
    target_record_lookup: task.input_context.target_record_id
    drive_subfolder_id: 10V8MACGNj4g7Yp3R-pi2LiuUK2aIuEpr
    field_map:
      Compliance Notes: $output.compliance_notes
  educare-course-page-copy:
    shape: airtable_only
    base_id: appO2kARkHl4yyKDm
    table_id: $task.input_context.target_table_id
    write_mode: update
    target_record_lookup: task.input_context.target_record_id
    field_map:
      LW Course Page Copy: $output.page_copy
  educare-toolkit-builder:
    shape: airtable_plus_drive
    base_id: appvcMQggBNe2XPk0
    table_id: tblZGRxS78VOmlwRd
    write_mode: create
    initial_status_field: Status
    initial_status_value: Draft
    approval_status_value: Approved
    drive_subfolder_id: 16cbCkLV3uWgR6KtIhncQd6CHEt3KRlO1
    field_map:
      Title: $output.title
      Type: $output.type
      Audience: $output.audience
      Track: $task.track_for_toolkit
      Description: $output.description
      Drive Folder: $deliverable.drive_url
      Free or Paid: $output.free_or_paid
      Date Created: $now
  educare-marketing:
    shape: airtable_only
    base_id: apphMrUMSEexbApjo
    table_id: tbl1uXcLNIXXhjI3Z
    write_mode: create
    initial_status_field: Status
    initial_status_value: Draft
    approval_status_value: Ready to Post
    field_map:
      LinkedIn Draft: $output.body
      Content Pillar: $task.content_pillar
      Platform: LinkedIn
      Draft Created Date: $now
      Notes: $output.notes
---

# Symphony Workflow

This file is the runtime contract for the Symphony orchestrator. The YAML front matter above defines all routing, identity, and destination behavior. Edit this file (not code) to change runtime policy.

## Skill Prompt Templates

Each skill registered in the `destinations` map has a corresponding prompt template block below. The orchestrator loads the appropriate skill file from `/skills/<skill-name>/SKILL.md` at dispatch time and prepends a system prompt that includes:

1. The agent identity and authorship metadata for the assigned Track.
2. The relevant guardrail context (NBCC pending status, BACB approved status, two-track terminology rules).
3. The task-specific Input context written by the intake skill.

The skill files themselves contain the operational logic for producing each deliverable type. Symphony does not duplicate that logic here.

## Adding a New Skill

To register a new skill:

1. Add the skill folder to `/skills/` with a `SKILL.md` file.
2. Add a `destinations` entry above with shape, base/table IDs, write mode, status field config, and field map.
3. Add the skill name as a `Skill` field option in the Tasks table (Command Center).
4. Add the skill to the intake skill's known-skills list.
5. Commit and push. The next tick picks it up.

## Validation

Symphony validates this file at startup. Failures block the entire tick (not individual runs). Validations performed:

- Every skill referenced in tasks has a matching `destinations` entry.
- `update`-mode destinations have `target_record_lookup` set.
- `airtable_plus_drive` and `drive_only` destinations have `drive_subfolder_id`.
- `create`-mode destinations have `initial_status_field`, `initial_status_value`, and `approval_status_value`.
- All referenced base IDs match the seven Symphony bases.
