# PDF REPORT STYLE & SUBMISSION SPECIFICATION — Minimal / Poppins

When asked to generate the report as a **PDF**, build it as HTML/CSS and render using this exact specification and design system.

---

## 1. Submission & Naming Requirements
* **Recommended File Format:** `report_lab01_{{your_student_id}}.pdf` (e.g., `report_lab01_6X07050XXXX.pdf`).
* **Single PDF File:** Must be submitted as a single, compiled PDF document.
* **Concise & Focused:** Keep content direct, concise, and focused. Avoid unnecessary filler or overly lengthy responses to prevent grading penalties.
* **Required 4-Part Structure:** The document MUST strictly follow this exact format:
  ```text
  Answer Part 1:
  [Place your content here]

  Answer Part 2:
  [Place your content here]

  Answer Part 3:
  [Place your content here]

  Answer Part 4:
  [Place your content here]
  ```

---

## 2. Lab 1 Context & Learning Outcomes
* **Course:** CPE 334 — Introduction to Software Engineering in the Age of AI Agents
* **Lab Name:** Lab 1. TokTickIT Full-Stack Hello World Starter
* **Type:** Assignments / Homework
* **Learning Outcomes:**
  - Build a full-stack vertical slice: React / Vite / Bootstrap UI → Express API → Prisma / PostgreSQL.
  - Implement REST endpoints, automated testing (Vitest / Supertest), and Git Flow.
  - Utilize GitHub Projects for task tracking and peer-reviewed Pull Requests.

---

## 3. Build Method
* Write HTML + inline `<style>` to a file, render with:
  ```python
  from weasyprint import HTML
  HTML("report.html").write_pdf("report.pdf")
  ```
* Install if missing: `pip install weasyprint --break-system-packages`
* Page size A4, margins `30mm 22mm 22mm 22mm`, page number bottom-right.

---

## 4. Typography & Font Rules
* **Google Font:** Poppins.
* Load via `@font-face` pointing at local `.ttf` files (weights 300/400/500/700) or embedded system font fallback.
* Body text: Poppins, weight 300, 10.3pt, line-height 1.55.
* Headings: Poppins 600–700.
* Code/terminal output: `DejaVu Sans Mono`, 8.4–8.6pt, in a light-gray block (`#f6f6f4`) with a left accent border.

---

## 5. Color Palette (Minimal, Single Accent)
* **Ink:** `#1c1c1c` (body), `#101010` (headings)
* **Muted gray:** `#6b6b6b` (labels/meta), `#9a9a9a` / `#a0a0a0` (footer, page number)
* **Hairlines:** `#e4e4e4` / `#f0f0f0`
* **Accent (Single color only):** `#2f7a4f` — used sparingly for the eyebrow label, part labels, and code-block border. Do not introduce a second accent color.
* **Missing/incomplete evidence:** `#b23b3b`, italic — never silently omitted, always flagged in this color.

---

## 6. Layout & Formatting Conventions
* **Cover block:** uppercase letter-spaced eyebrow line (course/lab code) → bold title → one muted meta line (name/program/semester). Thin hairline rule below.
* **Part Sections:** uppercase "PART 1: GIT USE WITH ENGINEERING WORKFLOW", "PART 2: TESTS", "PART 3: AI USE AND REFLECTION", "PART 4: APP DEMO".
* **Key-value facts:** (repo URL, project URL, etc.): use a flex `.field` row — fixed-width muted label on the left, value on the right, thin bottom hairline.
* **Tables:** header row uppercase, small, muted, with a solid dark bottom border; body rows separated by hairlines only — no vertical grid lines, no zebra striping.
* Left-align all body text (no justified text).

---

## 7. What NOT To Do
* Do NOT use more than one accent color.
* Do NOT add drop shadows, gradients, icons, or decorative graphics.
* Do NOT switch fonts mid-document — Poppins for all UI text, mono only for code/terminal content.
* Do NOT omit any required evidence.

---

## 8. Screenshot & Visual Evidence Placement Protocol
* **Dedicated Screenshot Containers:** For sections requiring visual proof (e.g. Part 1 Git PRs, Part 2 Test execution, Part 4 App Demo & Kanban board), allocate dedicated image containers/placeholders with proper spacing and captions:
  ```html
  <div class="screenshot-block">
    <div class="screenshot-placeholder">[ INSERT SCREENSHOT HERE: Description ]</div>
    <p class="screenshot-caption">Figure X: Detailed caption describing visual evidence</p>
  </div>
  ```
* **Screenshot Spacing & Styling Rules:**
  - **Margin & Spacing:** Provide `16px` vertical margins above and below screenshots to prevent text overlap.
  - **Borders & Frame:** Soft border `1px solid #e4e4e4`, background `#fafafa`, `4px` border radius.
  - **Captions:** Poppins font, `9pt`, muted gray `#6b6b6b`, centered beneath the image.
  - **Dimensions:** Max-width `100%`, max-height `160mm` to ensure images fit neatly within page margins without spilling onto next page.

