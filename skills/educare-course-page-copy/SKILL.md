---
name: educare-course-page-copy
description: >
  Generates complete, publish-ready LearnWorlds course sales page copy for EduCare LLC continuing
  education courses. Use this skill ANY TIME the user wants to create, draft, write, or generate a
  course page, sales page, course description, or marketing copy for a LearnWorlds course listing.
  Trigger when the user mentions "course page," "sales page," "LearnWorlds page," "course copy,"
  "course listing," "publish a course," or wants to write the text that goes on a course's landing
  page. Also trigger when the user says "write the page for [course name]," "I need copy for my
  course," or "generate the LearnWorlds content." This skill handles BOTH NBCC and BACB accredited
  courses — always use it regardless of accreditation type. Even partial requests like "write me a
  course headline" or "draft a meta description for my course" should trigger this skill.
---

# EduCare Course Page Copy Generator

This skill produces complete, publish-ready sales page copy for EduCare LLC's LearnWorlds course
listings. EduCare serves school-based mental and behavioral health professionals with continuing
education courses under two accreditation tracks: NBCC (for LPCCs, LMFTs, LCSWs) and BACB (for
BCBAs, BCaBAs). The output covers every section needed to publish a course page — headline through
meta description — in a single autonomous run.

---

## Company Context

- **Company:** EduCare LLC
- **Website:** educarecomplete.com
- **Contact:** admin@educarecomplete.com
- **Brand voice:** Professional, warm, practitioner-focused. Speaks directly to school-based
  clinicians. Avoids corporate jargon. Uses plain language that respects the reader's expertise.
- **Brand colors:** Navy `#1A1A8C`, Periwinkle `#B8B9EF`

---

## Instructors — Fixed, Never Ask the User

Assign the instructor automatically based on the accreditation type selected. Never prompt the user
for instructor information.

**NBCC Courses:**
- Name: Adam Sipes, M.A., PPS, LPCC
- Title: Program Administrator, EduCare LLC
- Role: Author and presenter of all NBCC-accredited courses

**BACB Courses:**
- Name: Marissa Butcher, M.S., AMFT, BCBA
- Title: BACB Course Author, EduCare LLC
- Role: Author and presenter of all BACB-accredited courses

---

## Accreditation Type Terminology — Critical Distinction

The two accreditation tracks use different terminology and compliance language. Mixing them is a
serious error. Confirm the accreditation type before doing anything else.

### NBCC (for LPCCs, LMFTs, LCSWs)
- Credit terminology: **clock hours** — never "CEUs" or "continuing education units"
- Compliance placeholder: `[NBCC COMPLIANCE STATEMENT — INSERT AFTER ACEP APPROVAL]`
  - Do NOT claim NBCC ACEP accreditation status in any output unless the user explicitly confirms
    in the current conversation that ACEP status has been granted
- Learning objectives: Bloom's Taxonomy action verbs (Identify, Analyze, Apply, Evaluate, etc.)
- Target audience language: school counselors, school social workers, LPCCs, LMFTs, LCSWs working
  in K-12 settings

### BACB (for BCBAs, BCaBAs)
- Credit terminology: **CEUs** — specifically BACB CEUs
- Compliance placeholder: `[BACB COMPLIANCE STATEMENT — INSERT AFTER ACE APPROVAL]`
  - Do NOT claim BACB ACE Provider status in any output unless the user explicitly confirms in the
    current conversation that ACE status has been granted
- Learning objectives: align with the BACB Ethics Code or relevant task list areas where applicable
- Target audience language: BCBAs, BCaBAs, behavior analysts working in school or educational settings

---

## Execution Flow

### Step 1: Ask for Accreditation Type

Before pulling from Airtable or collecting any other input, ask:

> Which accreditation type is this course under — NBCC or BACB?

This must be answered first because it determines:
- Which Airtable table to query
- Which terminology to use throughout
- Which instructor to assign
- How learning objectives are formatted

### Step 2: Pull Course Data from Airtable

Connect to the EduCare Courses Airtable base and retrieve the course list for the selected
accreditation type.

**Airtable IDs:**
```
Base ID: appO2kARkHl4yyKDm (EduCare Courses)

NBCC Courses Table: tbl2K0iXfxXeExGNl
  - Course Title:        fldHVnIY5dc4PszJ2
  - Status:              fldewwn16L3towH2L
  - Program Description: fld1YgKn2tLm8LsZd
  - Learning Objectives: fldR0z6hYoqL930hE
  - NBCC Content Area:   fldnJZDlLjboQt5Xk
  - Clock Hours:         fldDcwem93XC1S2as
  - Target Audience:     fldKDmRG8oC3v5Lid
  - Ethics Flag:         fld3GdPHayN8Z0Pz0
  - LW Course Page Copy: fldUhrEaGVCmlM9JH  (richText — stores the final generated copy)

BACB Courses Table: tbl4mR0nj4RjYsqe1
  - Course Title:        fldd9VutY6bQm15pR
  - Program Description: fldt8jd6RrqclffCj
  - Status:              fld3WSTF3xM9TtgVG
  - Learning Objectives: fldrRMDWhvahXitPZ
  - CEU Category:        fldY0aAQXfEmRXcph
  - CEU Value:           fldK0qTAvl1ay8Rp7
  - Target Audience:     fldrNMneqbOruIUuB
  - Ethics Flag:         fld9wt8pWm18oH6Qs
  - LW Course Page Copy: fld42yZlrG0C5CUV0  (richText — stores the final generated copy)
```

**Procedure:**
1. List all records from the appropriate table
2. Display them as a numbered list showing: title, status, and credit hours/CEUs
3. Ask: "Which course would you like to generate a sales page for? Select by number."
4. Pull all available fields for the selected course
5. Display what was pulled and ask: "I've pulled the following information from Airtable for this
   course. Does anything need to be updated before I generate the sales page?"
6. If confirmed, proceed immediately — no further prompting
7. If any required fields are missing from Airtable (price, prerequisites), ask only for those
   specific missing fields

### Step 3: Market Research and Suggested Pricing

After the course data is confirmed and before generating copy, conduct a pricing analysis:

1. Use web search to research current pricing for comparable continuing education courses in the
   same topic area, credit hour range, and accreditation type (NBCC or BACB). Look at:
   - Other online CE providers offering self-paced home study courses for the same license types
   - Courses with similar credit hour counts
   - Courses covering the same or closely related topics
   - Price-per-credit-hour benchmarks in the CE market for the relevant profession

2. Compile 3-5 comparable courses with their prices, credit hours, and providers as reference points.

3. Recommend a specific price for the EduCare course with a brief rationale (2-3 sentences)
   explaining the pricing logic — e.g., competitive positioning, per-credit-hour rate, topic
   demand, and where EduCare should sit relative to budget and premium providers.

4. Present the suggested price and comparables to the user. Ask: "Here's my suggested price
   based on the current market. Want to use this, adjust it, or skip pricing for now?"

5. Whatever the user confirms becomes the price used in the Course Details Block. If the user
   skips pricing, use `[PRICE TBD]` as the placeholder.

### Step 4: Generate Condensed Output

Once the data is confirmed, generate the condensed course page copy in a single pass. Do not
pause for approval between sections. The output should be ready to copy-paste into LearnWorlds.

---

## Output Sections — Condensed Format (Default)

The condensed format is the standard output. It produces a tighter, more scannable course page
by combining and trimming sections. Generate all sections below in this order:

### 1. Headline
One punchy, benefit-driven headline under 12 words. No jargon. Speaks to what the practitioner
will be able to do after completing the course. Focus on the outcome, not the topic.

**Good:** "Navigate FERPA and HIPAA Without Second-Guessing Yourself"
**Bad:** "HIPAA and FERPA Compliance Training for School Professionals"

### 2. Subheadline
One sentence expanding on the headline. Names the target audience and format (self-paced CE).

### 3. Course Description
One paragraph, 4-6 sentences, written in second person ("you"). Combine the pain point,
what the course covers, what makes it different, and the takeaway into a single tight paragraph.
No fluff, no filler. Every sentence earns its place.

Tone: Warm, direct, practitioner-to-practitioner. Not salesy. Not academic.

### 4. What You'll Learn
Bullet list of 3-4 practitioner-facing outcomes. Plain-language "what's in it for me" version.
Start each bullet with an action phrase. Trim to the most compelling outcomes only.

### 5. Course Details Block
Formatted as a single clean line block:

```
[X clock hours / X BACB CEUs] | On-demand, self-paced | $[price]
[NBCC COMPLIANCE STATEMENT — INSERT AFTER ACEP APPROVAL] or
[BACB COMPLIANCE STATEMENT — INSERT AFTER ACE APPROVAL]
Certificate issued upon completion of assessment and program evaluation
```

### 6. Instructor
One line only. Auto-populated based on accreditation type. Do not ask the user.

- **NBCC:** Adam Sipes, M.A., PPS, LPCC — Program Administrator, EduCare LLC
- **BACB:** Marissa Butcher, M.S., AMFT, BCBA — BACB Course Author, EduCare LLC

### Sections Removed in Condensed Format
The following sections from the full format are intentionally omitted:
- Formal Learning Objectives (kept in Airtable for compliance, not needed on sales page)
- Who This Course Is For (audience is named in the subheadline)
- Full Instructor Bio (replaced with one-liner)
- Meta Description (generated separately if needed for SEO, not part of the page copy)

---

## Post-Generation Behavior

1. Upload the generated condensed copy to the course's
   Airtable record in the **LW Course Page Copy** field:
   - **NBCC table:** field ID `fldUhrEaGVCmlM9JH`
   - **BACB table:** field ID `fld42yZlrG0C5CUV0`
   - Compile all output sections (Headline through Meta Description) into a single richText
     value with clear section headers and formatting preserved
   - Update the record using the record ID retrieved in Step 2
   - Confirm to the user: "Course page copy has been saved to Airtable."
   - If the update fails, notify the user of the error rather than failing silently

---

## Rules

- Always ask for accreditation type first — before the Airtable pull
- Pull from Airtable before asking the user for any other information
- Never mix NBCC and BACB terminology in the same output
- Never claim accreditation status for either body — use compliance statement placeholders unless
  the user has confirmed approval in the current conversation
- Never ask the user who the instructor is — assign automatically
- If learning objectives from Airtable are rough or incomplete, clean and reformat them
- Run fully autonomously once accreditation type is confirmed and Airtable data is verified
- Do not pause for approval mid-generation
- Write in second person for the course description and "What You'll Learn" sections
- Keep the brand voice: professional, warm, practitioner-focused, no corporate jargon
