---
name: nbcc-course-creator
description: >
  Creates complete NBCC ACEP-compliant continuing education courses for LPCCs, LMFTs, and LCSWs,
  structured for direct LearnWorlds bulk upload. Use this skill ANY TIME the user wants to build,
  draft, outline, or develop a CE course or training for mental health professionals. Trigger when
  the user mentions NBCC, ACEP, LPC, LPCC, LMFT, LCSW, NCC, counselor CE, therapist continuing
  education, ethics hours, home study programs, or LearnWorlds course creation for mental health
  professionals. Even a vague mention like "I want to make a course on [topic]" or "help me build
  a counseling training" should trigger this skill. Also trigger for partial tasks: regenerating an
  assessment, rewriting a lesson, updating references, or any piece of a CE course for counselors.
---

# NBCC Course Creator — Parent Orchestrator

This skill system is split into four child skills plus shared reference files. Load only what the
task requires. Do NOT load all children for every request — match scope to the work needed.

---

## Child Skills (Read Before Executing)

| Skill | Path | Load When |
|-------|------|-----------|
| Blueprint | `references/blueprint.md` | Any course build; also for compliance-only questions |
| Content | `references/content.md` | Writing or rewriting lesson prose |
| Documents | `references/documents.md` | Assessment, evaluation form, references, course description |
| Operations | `references/operations.md` | File structure, Airtable write, LearnWorlds upload steps |

---

## Task → Load Map

**Full course build (most common):**
Read all four reference files, then execute in this order:
1. Blueprint → 2. Content → 3. Documents → 4. Operations

**Blueprint only** (topic validation, objective writing, compliance check):
Read `references/blueprint.md` only.

**Lesson rewrite or content edit:**
Read `references/blueprint.md` + `references/content.md`.

**Assessment, evaluation, or references only:**
Read `references/blueprint.md` + `references/documents.md`.

**Airtable record, file organization, or LearnWorlds steps only:**
Read `references/operations.md` only.

---

## Non-Negotiable Rules (Memorize — Apply to Every Task)

- NBCC credit = **clock hours / CE hours / credit hours** — the word **CEU is prohibited**
- **1 NBCC clock hour = 6,000 words of qualifying instructional text**
- Word count excludes: references, quiz questions, evaluation forms, reflection prompts, key takeaways
- Target audience is always exactly: **LPCCs, LMFTs, and LCSWs** — no other disciplines
- BCBA content → route to bcba-course-creator skill, not this one
- Placeholder for accreditation number: **[NBCC ACEP Number — Pending]**
- NBCC staff **read the full program and take the assessment** during application review — quality matters

---

## Execution Behavior

- **No pauses. No approval gates. No mid-task check-ins.**
- Make professional default decisions for anything the user hasn't specified.
- The only thing that stops execution: course topic is completely absent.
- After reading required child skills, execute fully and deliver.
