---
name: bcba-course-creator
description: >
  Creates complete BACB-compliant continuing education courses for BCBAs and BCaBAs, ready for LearnWorlds import.
  Use this skill ANY TIME the user wants to build, draft, outline, or develop a CE course, CEU content, or professional
  development material for behavior analysts. Also trigger when the user mentions BCBA, BCaBA, BACB, ABA courses, ACE
  provider content, ethics CEUs, supervision CEUs, or LearnWorlds course creation. Even a vague mention like "I want to
  make a course on [topic]" or "help me build a training" should trigger this skill if the user is in the ABA/behavior
  analysis space.
---

# BCBA Continuing Education Course Creator

This skill generates complete, BACB-compliant CE courses for BCBAs and BCaBAs, structured for direct import into LearnWorlds.

---

## Step 1: Gather Intent

Ask the user for:
1. **Topic / working title** — e.g., "Ethical Decision-Making in Telehealth ABA"
2. **CEU category** — General (Type 2), Ethics, Supervision, or combination
3. **CEU count / duration** — how many CEUs (0.5 increments; 1 CEU = 50 min of instruction)
4. **Target audience nuance** — BCBAs only, BCaBAs included, supervisors specifically?
5. **Any source material** — notes, research articles, existing content they want to draw from

If they have a topic but no CEU count, suggest: 1 CEU (50 min) for focused topics, 2 CEUs (100 min) for broader ones.

> **ACE Provider Status Note:** This user is currently in the process of becoming an ACE Provider — they are not yet approved. All course materials should be built to be fully compliant and ready to submit as the required sample event with their ACE application. Remind the user when relevant that courses cannot be offered for official BACB CEUs until ACE Provider status is granted. The sample event submitted with the application must meet all Learning CE requirements. See `references/ace-application.md` for application guidance.

---

## Step 2: BACB Compliance Check

Before writing any content, confirm the course meets ACE Provider standards. Read `references/bacb-compliance.md` for the full ruleset. Key gates:

- [ ] Content is **behavior-analytic in nature** (practice, science, methodology, theory, or philosophy of behavior analysis)
- [ ] Audience is certified professionals (BCBA/BCaBA level) — **not** parents, RBTs, or other disciplines
- [ ] Content **goes beyond intro-level** — no defining basic principles without extending to advanced application
- [ ] CEU math is correct — **0.5 CEU per 25 minutes of instruction**, no rounding up
- [ ] Ethics flag: content covers ethical issues in BA practice or relates to BACB ethics requirements
- [ ] Supervision flag: content is behavior-analytic AND covers effective supervision per the BACB Supervisor Training Curriculum Outline (2.0)
- [ ] Content is **accurate, current, and consistent with best available science**
- [ ] Learning objectives are **clear and specific** — describe what the instructor aims to accomplish

If any gate fails, flag it to the user before proceeding.

---

## Step 3: Generate the Course Package

Produce ALL of the following outputs. See `references/output-formats.md` for templates and formatting specs.

### 3a. Course Outline Document (.docx)
A structured Word document containing:
- Course title, CEU category, CEU value, and target audience
- Instructor disclosure section placeholder
- Course description (150–200 words, professional tone, suitable for LearnWorlds course page)
- 3–5 measurable learning objectives (action-verb format: "Participants will be able to...")
- Module/section breakdown with estimated time per section
- Reference list (APA 7th format, peer-reviewed sources where possible)

### 3b. Full Lesson Content (.docx)
A complete instructor-ready script / learner-facing content document:
- Each module written as prose content (~500–800 words per CEU of instruction)
- Callout boxes for key definitions, examples, case vignettes
- Case vignettes must be realistic ABA scenarios — not generic examples
- Ethics courses: include at least one BACB Ethics Code reference per major section
- Supervision courses: tie content explicitly to the BACB Supervisor Training Curriculum Outline 2.0

### 3c. Quiz / Assessment Questions (.docx)
- Minimum 5 questions per CEU (10 for a 2-CEU course, etc.)
- Mix of formats: multiple choice, true/false, short-answer/reflection prompts
- Each multiple choice item: 1 correct answer + 3 plausible distractors
- Questions must assess the learning objectives — map each question to an objective
- Include an answer key with rationale for each correct answer
- For ethics courses: include at least 2 scenario-based questions referencing the BACB Ethics Code

### 3d. LearnWorlds-Ready Folder Structure
Produce a plain-text manifest file (`learnworlds-import-manifest.txt`) that tells the user exactly how to organize and name their files for bulk upload:

```
CourseTitle_LW_Import/
├── 1_[Module Name]/
│   ├── 1_[Lesson Title].docx       ← ebook activity
│   ├── 2_[Lesson Title].pdf        ← PDF activity (if applicable)
│   └── 3_[Quiz Name].docx          ← quiz/assessment
├── 2_[Module Name]/
│   └── ...
└── course-description.txt          ← paste into LW course overview
```

Naming convention: `[order number]_[Title with no special characters]`
Remind the user: ZIP the folder for bulk upload; LearnWorlds converts .docx → ebook activity automatically.

---

## Step 4: Certificate Documentation Checklist

Generate a short checklist the user can use to issue compliant CE certificates to learners once ACE Provider status is approved. Per BACB ACE Handbook requirements, each certificate must include:

- [ ] Participant's full name
- [ ] Title of the event
- [ ] Date of the event / completion date
- [ ] CEU value awarded
- [ ] CEU category (General / Ethics / Supervision)
- [ ] ACE Provider name and number ← **placeholder until ACE approval is granted**
- [ ] Instructor name and credentials

Remind the user: certificates must be issued within **45 days** of course completion.

> **Pre-approval reminder:** Do not include a real ACE Provider number in any materials until the BACB has granted ACE Provider status. Use `[ACE Provider Number — Pending]` as a placeholder. Courses built now can be used as the sample event for the ACE application and then activated for official CEUs once approved.

---

## Step 5: Quality Pass

Before presenting outputs to the user, run a self-check:

- Do the learning objectives use action verbs (analyze, apply, demonstrate, evaluate)?
- Does the content level assume BCBA/BCaBA graduate-level training?
- Is the CEU math correct for the content length?
- Are case vignettes plausible and grounded in real ABA practice contexts?
- Is the course description suitable to paste directly into LearnWorlds?
- Does the quiz assess the objectives (not just recall facts)?

Flag anything that needs user input before finalizing.

---

## Step 6: Airtable Record Creation

After all files pass the quality check, write a record to the EduCare Courses Airtable base. This keeps the course catalog current and gives the team a single place to track production status across all BACB courses.

**Hardcoded IDs — do not change:**
```
Base ID:  appO2kARkHl4yyKDm   (EduCare Courses)
Table ID: tbl4mR0nj4RjYsqe1   (BACB Courses)
```

**Field Mapping:**

| Field Name | Field ID | Value |
|---|---|---|
| Course Title | fldd9VutY6bQm15pR | Full course title |
| Program Description | fldt8jd6RrqclffCj | Full program description (150–200 words) |
| Status | fld3WSTF3xM9TtgVG | "In Production" |
| Learning Objectives | fldrRMDWhvahXitPZ | All objectives, numbered, one per line |
| CEU Category | fldY0aAQXfEmRXcph | "General", "Ethics", or "Supervision" |
| CEU Value | fldK0qTAvl1ay8Rp7 | Numeric CEU value (e.g., 1.5, 2, 3) |
| Instructional Time | fldiy7QINwdtYPqRX | Total minutes of instruction |
| Target Audience | fldrNMneqbOruIUuB | ["BCBA", "BCaBA"] or subset |
| Google Drive Folder | fldbKq9KkPRc90s9q | Leave blank — filled manually after Drive upload |
| Date Created | fldEkUpnK5A8BRpNP | Today's date (ISO format: YYYY-MM-DD) |
| Total Word Count | fldhSieWcoGiotofs | Verified qualifying instructional word count |
| Ethics Flag | fld9wt8pWm18oH6Qs | true if course covers ethical issues, false otherwise |
| Supervision Flag | fldmYnuEswXcBjtYL | true if course covers supervision content, false otherwise |
| Course ID | fldkcrX2FWV3lTfyj | Leave blank — assigned after ACE approval |

Use `typecast: true` when creating the record so select field values are matched by name.

**If the Airtable write fails:** Include the field values in the delivery summary so the user can enter them manually. Do not stop execution — note the failure and continue to output delivery.

---

## Output Delivery

Use the `docx` skill to produce the actual .docx files. Read `/mnt/skills/public/docx/SKILL.md` before generating any Word documents.

Deliver:
1. Course Outline .docx
2. Full Lesson Content .docx
3. Quiz & Assessment .docx
4. `learnworlds-import-manifest.txt`
5. Certificate Checklist (inline in chat or as a short .docx)

Present all files using the `present_files` tool so the user can download them directly.

---

## Reference Files

- `references/bacb-compliance.md` — Full BACB ACE compliance ruleset and ethics/supervision subcategory details
- `references/output-formats.md` — Templates and formatting specs for each deliverable
- `references/learnworlds-import.md` — LearnWorlds bulk upload mechanics, SCORM notes, file type mapping
- `references/ace-application.md` — ACE Provider application requirements, eligibility criteria, and sample event guidance
