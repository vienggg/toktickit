# PDF REPORT STYLE — Minimal / Poppins

When the user asks to generate the report as a **PDF**, build it as HTML/CSS and render with WeasyPrint using this exact design system. Content/sections still come from `report_style.md` (tone, honesty, `[MISSING]` rule) + whatever format is assigned — this file only governs the visual style.

## Build method
* Write HTML + inline `<style>` to a file, render with:
  ```python
  from weasyprint import HTML
  HTML("report.html").write_pdf("report.pdf")
  ```
* Install if missing: `pip install weasyprint --break-system-packages`
* Page size A4, margins `30mm 22mm 22mm 22mm`, page number bottom-right.

## Font
* Google Font: **Poppins** (already available locally at `/usr/share/fonts/truetype/google-fonts/`).
* Load via `@font-face` pointing at the local `.ttf` files (weights 300/400/500/700) — do not fetch from fonts.googleapis.com, it's not reachable from this environment.
* Body text: Poppins, weight 300, 10.3pt, line-height 1.55.
* Headings: Poppins 600–700.
* Code/terminal output: `DejaVu Sans Mono`, 8.4–8.6pt, in a light-gray block (`#f6f6f4`) with a left accent border.

## Color palette (minimal, one accent)
* Ink: `#1c1c1c` (body), `#101010` (headings)
* Muted gray: `#6b6b6b` (labels/meta), `#9a9a9a` / `#a0a0a0` (footer, page number)
* Hairlines: `#e4e4e4` / `#f0f0f0`
* Accent (single color only): `#2f7a4f` — used sparingly for the eyebrow label, part labels, and code-block border. Do not introduce a second accent color.
* Missing/incomplete evidence: `#b23b3b`, italic — never silently omitted, always flagged in this color.

## Layout conventions
* **Cover block:** uppercase letter-spaced eyebrow line (course/lab code) → bold title → one muted meta line (name/program/semester). Thin hairline rule below.
* **Each section:** small uppercase "part label" (e.g. point value) above a heading — not a numbered `##` alone; keep visual hierarchy consistent across sections.
* **Key-value facts** (repo URL, project URL, etc.): use a flex `.field` row — fixed-width muted label on the left, value on the right, thin bottom hairline. Not a bullet list.
* **Tables:** header row uppercase, small, muted, with a solid dark bottom border; body rows separated by hairlines only — no vertical grid lines, no zebra striping.
* **Lists:** used only for genuinely unordered items (e.g. demo screenshots), not for structured facts.
* Generous whitespace over dense packing — this is the point of "minimal." No borders/boxes around whole sections, no background fills except code blocks.
* Footer note in small muted gray stating what the report was generated from.

## What NOT to do
* No more than one accent color.
* No drop shadows, gradients, icons, or decorative graphics.
* No justified text; left-align everything.
* Don't switch fonts mid-document — Poppins for all UI text, mono only for code/terminal content.
