"""Build the single Lab 3 submission PDF from the checked-in evidence.

Run from the repository root with a Python environment containing ReportLab
and Pillow. The builder deliberately marks unavailable post-I-11 evidence as
pending; --final refuses to produce a submission until that evidence exists.
"""

from __future__ import annotations

import argparse
import html
import re
import subprocess
import textwrap
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "report_lab03_67070503404.pdf"
EVIDENCE = ROOT / "artifacts" / "lab-03" / "report-evidence"
SCREENSHOTS = ROOT / "artifacts" / "lab-03" / "screenshots"
GREEN = colors.HexColor("#006B3C")
INK = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
RED = colors.HexColor("#B23B3B")


def register_fonts() -> None:
    font_dir = Path.home() / "AppData/Local/Microsoft/Windows/Fonts"
    poppins = {
        "Poppins": "Poppins-Regular.ttf",
        "Poppins-Light": "Poppins-Light.ttf",
        "Poppins-Medium": "Poppins-Medium.ttf",
        "Poppins-Bold": "Poppins-Bold.ttf",
        "Poppins-Italic": "Poppins-Italic.ttf",
    }
    for name, filename in poppins.items():
        path = font_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"Required report font not installed: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFont(TTFont("Consolas", r"C:\Windows\Fonts\consola.ttf"))
    pdfmetrics.registerFontFamily(
        "Poppins", normal="Poppins", bold="Poppins-Bold", italic="Poppins-Italic",
        boldItalic="Poppins-Bold",
    )


def styles() -> dict[str, ParagraphStyle]:
    base = dict(fontName="Poppins-Light", textColor=INK, alignment=TA_LEFT)
    return {
        "body": ParagraphStyle("body", fontSize=9.2, leading=14.2, spaceAfter=7, **base),
        "small": ParagraphStyle("small", fontSize=8.2, leading=12, spaceAfter=5, **base),
        "cover": ParagraphStyle("cover", fontName="Poppins-Bold", fontSize=26, leading=31, textColor=GREEN, spaceAfter=14),
        "part": ParagraphStyle("part", fontName="Poppins-Bold", fontSize=17, leading=23, textColor=GREEN, spaceAfter=14),
        "h1": ParagraphStyle("h1", fontName="Poppins-Bold", fontSize=13, leading=18, textColor=GREEN, spaceBefore=12, spaceAfter=7),
        "h2": ParagraphStyle("h2", fontName="Poppins-Medium", fontSize=11, leading=15, textColor=INK, spaceBefore=9, spaceAfter=5),
        "h3": ParagraphStyle("h3", fontName="Poppins-Medium", fontSize=9.5, leading=13, textColor=INK, spaceBefore=8, spaceAfter=4),
        "table": ParagraphStyle("table", fontSize=8.1, leading=11.8, leftIndent=12, spaceAfter=4, **base),
        "quote": ParagraphStyle("quote", fontName="Poppins-Italic", fontSize=8.7, leading=13, textColor=INK, leftIndent=13, rightIndent=8, spaceAfter=7),
        "caption": ParagraphStyle("caption", fontName="Poppins-Medium", fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=MUTED, spaceAfter=13),
        "pending": ParagraphStyle("pending", fontName="Poppins-Italic", fontSize=9, leading=13.5, textColor=RED, spaceAfter=9),
    }


def inline_markdown(raw: str) -> str:
    value = html.escape(raw, quote=False)
    value = re.sub(r"\[([^]]+)\]\((https?://[^)]+)\)", lambda m: f'<link href="{m.group(2)}" color="#006B3C">{m.group(1)}</link>', value)
    value = re.sub(r"`([^`]+)`", lambda m: f'<font face="Consolas">{m.group(1)}</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    return value


def add_text(story: list, text: str, style: ParagraphStyle) -> None:
    if text.strip():
        story.append(Paragraph(inline_markdown(text.strip()), style))


def add_code(story: list, lines: list[str]) -> None:
    wrapped: list[str] = []
    for line in lines:
        wrapped.extend(textwrap.wrap(line, 95, replace_whitespace=False, drop_whitespace=False) or [""])
    code_style = ParagraphStyle("code", fontName="Consolas", fontSize=7.2, leading=10, textColor=INK)
    story.append(Preformatted("\n".join(wrapped), code_style, maxLineLength=95))
    story.append(Spacer(1, 8))


def add_table(story: list, lines: list[str], st: dict[str, ParagraphStyle]) -> None:
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    if len(rows) < 2:
        for line in lines:
            add_text(story, line, st["small"])
        return
    headings = rows[0]
    for row in rows[2:]:
        if not any(row):
            continue
        pairs = [f"**{headings[i]}:** {cell}" for i, cell in enumerate(row) if i < len(headings) and cell]
        if pairs:
            add_text(story, "   |   ".join(pairs[:2]), st["table"])
            for pair in pairs[2:]:
                add_text(story, pair, st["table"])
            story.append(Spacer(1, 3))


def render_markdown(story: list, path: Path, st: dict[str, ParagraphStyle]) -> None:
    add_text(story, f"Rendered document: `{path.relative_to(ROOT).as_posix()}`", st["h1"])
    # utf-8-sig removes the BOM used by reviewer.md so its first heading
    # renders as a heading rather than as literal "#" body text.
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            add_text(story, " ".join(paragraph), st["body"])
            paragraph.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            flush()
            i += 1
            continue
        if stripped.startswith("```"):
            flush()
            code: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            add_code(story, code)
            i += 1
            continue
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?[-:| ]+\|?\s*$", lines[i + 1]):
            flush()
            table: list[str] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table.append(lines[i])
                i += 1
            add_table(story, table, st)
            continue
        if stripped.startswith("#"):
            flush()
            level = len(stripped) - len(stripped.lstrip("#"))
            add_text(story, stripped[level:].strip(), st["h1" if level <= 2 else "h2" if level == 3 else "h3"])
        elif stripped in {"---", "***"}:
            flush()
            story.append(HRFlowable(width="100%", thickness=.5, color=colors.HexColor("#E2E8F0"), spaceBefore=7, spaceAfter=9))
        elif stripped.startswith(">"):
            flush()
            add_text(story, stripped.lstrip("> "), st["quote"])
        elif re.match(r"^(?:[-*+] |\d+[.)] )", stripped):
            flush()
            add_text(story, "• " + re.sub(r"^(?:[-*+] |\d+[.)] )", "", stripped), st["body"])
        else:
            paragraph.append(stripped)
        i += 1
    flush()


def figure(story: list, path: Path, caption: str, st: dict[str, ParagraphStyle], *, new_page: bool = False, wide: bool = False) -> None:
    if new_page:
        story.append(PageBreak())
    if not path.exists():
        add_text(story, f"Missing evidence: {path.relative_to(ROOT)}", st["pending"])
        return
    with PILImage.open(path) as source:
        width, height = source.size
    scale = min((750 if wide else 510) / width, (460 if wide else 560) / height)
    graphic = Image(str(path), width=width * scale, height=height * scale)
    graphic.hAlign = "CENTER"
    story.append(KeepTogether([graphic, Spacer(1, 7), Paragraph(inline_markdown(caption), st["caption"])]))


def add_gallery(story: list, folder: str, st: dict[str, ParagraphStyle], prefix: str) -> None:
    story.append(NextPageTemplate("landscape"))
    index = 0
    for path in sorted((SCREENSHOTS / folder).glob("*.png")):
        label = path.stem.removeprefix("Figure-").replace("@", " - ").replace("-", " ")
        crops: list[Path] = [path]
        if folder == "staff-ticket-detail":
            # Full-page detail screenshots are 1,900-2,500 pixels tall. A
            # whole-page thumbnail would make labels illegible in the PDF.
            with PILImage.open(path) as source:
                width, height = source.size
                left, right = (160, min(width, 1120)) if width >= 1200 else (0, width)
                starts = list(range(0, height, 650))
                crops = []
                crop_dir = ROOT / "tmp" / "pdfs" / "crops"
                crop_dir.mkdir(parents=True, exist_ok=True)
                for segment, top in enumerate(starts, 1):
                    box = (left, max(0, top - 25), right, min(height, top + 700))
                    destination = crop_dir / f"{path.stem}-segment-{segment}.png"
                    source.crop(box).save(destination)
                    crops.append(destination)
        elif folder == "authentication" and path.name in {
            "Figure-login-form@desktop.png", "Figure-after-logout@desktop.png",
            "Figure-forced-change-password-screen@desktop.png",
        }:
            with PILImage.open(path) as source:
                width, height = source.size
                crop_dir = ROOT / "tmp" / "pdfs" / "crops"
                crop_dir.mkdir(parents=True, exist_ok=True)
                destination = crop_dir / f"{path.stem}-center.png"
                source.crop((width // 4, 100, width * 3 // 4, min(height, 800))).save(destination)
                crops = [destination]
        for segment, crop in enumerate(crops, 1):
            index += 1
            suffix = f" (detail segment {segment}/{len(crops)})" if len(crops) > 1 else ""
            figure(story, crop, f"Figure {prefix}.{index}: {label.capitalize()}{suffix}.", st, new_page=True, wide=True)
    story.append(NextPageTemplate("normal"))


def on_page(canvas, doc) -> None:
    canvas.saveState()
    page_width, page_height = canvas._pagesize
    canvas.setFillColor(GREEN)
    canvas.rect(0, page_height - 9, page_width, 9, fill=1, stroke=0)
    canvas.setFont("Poppins-Medium", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(44, 29, "CPE 334  /  LAB 3  /  TOKTICKIT")
    canvas.drawRightString(page_width - 44, 29, f"{doc.page}")
    canvas.restoreState()


def part(story: list, number: int, title: str, st: dict[str, ParagraphStyle]) -> None:
    story.append(PageBreak())
    story.append(Paragraph(f"Answer Part {number}: {html.escape(title)}", st["part"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN, spaceAfter=12))


def build(final: bool) -> None:
    register_fonts()
    st = styles()
    board = EVIDENCE / "kanban-all-done.png"
    spec_pr = EVIDENCE / "spec-pr-62-merged.png"
    test_logs = [EVIDENCE / name for name in ("main-server-tests.txt", "main-client-tests.txt", "main-e2e-tests.txt")]
    missing = [path for path in [board, spec_pr, *test_logs] if not path.exists()]
    if final and missing:
        raise SystemExit("Final report blocked by missing evidence: " + ", ".join(str(p) for p in missing))
    if final:
        merged = subprocess.run(
            ["git", "merge-base", "--is-ancestor", "origin/docs/lab3-report-final", "origin/main"],
            cwd=ROOT, check=False,
        )
        if merged.returncode != 0:
            raise SystemExit("Final report blocked: the I-11 review branch is not merged into origin/main")

    story: list = []
    story.append(Spacer(1, 64))
    add_text(story, "CPE 334 | Lab 3 submission report", st["cover"])
    add_text(story, "TokTickIT - Users, Roles, IT Staff Ticketing, and Admin Screens", st["h1"])
    for line in [
        "**Author:** Garunyapas Danpitakkul (Vieng), 67070503404, [@vienggg](https://github.com/vienggg)",
        "**Recorded GitHub reviewer:** [@projectnewy](https://github.com/projectnewy); originally designated course peer: Dechayut, 67070503414, @NinjoMUDA (identity relationship unverified)",
        "**Repository:** [github.com/vienggg/toktickit](https://github.com/vienggg/toktickit)",
        "**Kanban:** [TokTickIT Kanban](https://github.com/users/vienggg/projects/1)",
        "**Release:** [PR #71](https://github.com/vienggg/toktickit/pull/71), reviewed and merged into `main` at `e48d2c8`; tag `lab3-release`",
    ]:
        add_text(story, line, st["body"])
    if not final:
        add_text(story, "DRAFT: I-11 review/merge, all-Done board image, and final main-branch E2E output remain pending. Do not submit this draft.", st["pending"])

    part(story, 1, "Git Use with Engineering Workflow", st)
    add_text(story, "Each Lab 3 issue used a dedicated branch into `lab3-staging`; [PR #71](https://github.com/vienggg/toktickit/pull/71) integrated staging into `main`. [PR #72](https://github.com/vienggg/toktickit/pull/72) carried the release-review corrections. One direct staging push (`047b5bf`) violated the intended flow and is recorded honestly in the peer-review log.", st["body"])
    add_code(story, [
        "docs/lab3-spec-and-test-plan -> PR #62 -> lab3-staging",
        "feature/lab3-* -> PRs #63-#70 -> lab3-staging",
        "feature/lab3-release-review-fixes -> PR #72 -> lab3-staging",
        "lab3-staging -> PR #71 -> main (e48d2c8) -> lab3-release tag",
        "docs/lab3-report-final -> I-11 / issue #60 (merged)" if final else "docs/lab3-report-final -> I-11 / issue #60 (pending peer review)",
    ])
    add_text(story, "The release commit graph preserves the peer-reviewed branches and merges (short SHAs from `git log --graph --oneline origin/main`):", st["h2"])
    add_code(story, [
        "e48d2c8 Merge PR #71: lab3-staging -> main (lab3-release)",
        "  9a98cb5 Merge PR #72: release-review-fixes -> lab3-staging",
        "    ab7495e fix(lab3): address release review findings",
        "  8af35e8 Merge PR #70: e2e-and-visual -> lab3-staging",
        "  2354b35 Merge PR #69: user-administration -> lab3-staging",
        "  f999d18 Merge PR #68: staff-ticket-detail -> lab3-staging",
        "  6eaccff Merge PR #67: staff-queue -> lab3-staging",
        "  ec8c65a Merge PR #64: auth-foundation -> lab3-staging",
        "  [See the linked PRs and repository History for the complete graph]",
    ])
    add_text(story, "Repository layout at the release commit (`git ls-tree`), including the required evidence folders:", st["h2"])
    add_code(story, [
        "toktickit/",
        "  README.md  .gitignore  client/  server/  e2e/lab-03/",
        "  docs/lab-03/{specification,api-spec,ui-spec,tests,reviewer,ai-use}.md",
        "  artifacts/lab-03/screenshots/",
        "    authentication/  staff-queue/  staff-ticket-detail/  user-management/",
    ])
    figure(story, board, "Figure 1.1: Final GitHub Project board with every Sprint 3 issue in Done.", st)
    add_text(story, "Peer-review source: [reviewer.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-03/reviewer.md).", st["small"])
    render_markdown(story, ROOT / "docs/lab-03/reviewer.md", st)

    part(story, 2, "Spec DD", st)
    add_text(story, "The engineering contract was merged before implementation PRs. All timestamps below are UTC, taken from the merged PR records.", st["body"])
    add_table(story, [
        "| Milestone | Merge time (UTC) | Evidence |",
        "|---|---|---|",
        "| Spec PR #62 | 2026-09-16 10:48:21 | [PR #62](https://github.com/vienggg/toktickit/pull/62) |",
        "| Auth PR #64 | 2026-09-16 11:49:11 | [PR #64](https://github.com/vienggg/toktickit/pull/64) |",
        "| Staff Queue PR #67 | 2026-09-17 10:24:02 | [PR #67](https://github.com/vienggg/toktickit/pull/67) |",
        "| Staff Detail PR #68 | 2026-09-18 08:26:46 | [PR #68](https://github.com/vienggg/toktickit/pull/68) |",
        "| Admin PR #69 | 2026-09-18 09:18:00 | [PR #69](https://github.com/vienggg/toktickit/pull/69) |",
    ], st)
    figure(story, spec_pr, "Figure 2.1: Merged specification PR #62 header, preceding the implementation PRs.", st)
    add_text(story, "Specification source: [specification.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-03/specification.md). The supporting [api-spec.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-03/api-spec.md) is rendered next.", st["small"])
    render_markdown(story, ROOT / "docs/lab-03/specification.md", st)
    render_markdown(story, ROOT / "docs/lab-03/api-spec.md", st)

    part(story, 3, "Test DD and Traceability", st)
    add_text(story, "On release commit `e48d2c8`, server Vitest passed 251/251 and client Vitest passed 69/69. The first browser run passed 29/30 and exposed the Create User/list-refresh race; the I-11 fix branch then passed 30/30. " + ("The final merged-main verification output follows." if final else "The final main-branch browser result must be captured after I-11 merges."), st["body"])
    for path in test_logs:
        add_text(story, f"Command output: `{path.name}`", st["h2"])
        if path.exists():
            add_code(story, path.read_text(encoding="utf-8", errors="replace").splitlines())
        else:
            add_text(story, "Final main-branch command output pending.", st["pending"])
    add_text(story, "Traceability source: [tests.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-03/tests.md).", st["small"])
    render_markdown(story, ROOT / "docs/lab-03/tests.md", st)

    part(story, 4, "AI Use with Reflection", st)
    add_text(story, "The chronological AI-use log below highlights ten prompts for grading while preserving the full, append-as-work-happened record and the author's reflection.", st["body"])
    add_text(story, "AI-use source: [ai-use.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-03/ai-use.md).", st["small"])
    render_markdown(story, ROOT / "docs/lab-03/ai-use.md", st)

    part(story, 5, "Working Login and Password Change UI", st)
    add_text(story, "The image series shows the login form, forced first-password change, successful continuation and logout at desktop, tablet, and mobile where available. Invalid credentials, inactive accounts and safe errors are covered by the auth API/component tests; these conditions are not falsely claimed as separate screenshots.", st["body"])
    add_gallery(story, "authentication", st, "5")

    part(story, 6, "Working IT Staff Ticket Queue UI", st)
    add_text(story, "The queue evidence shows real seeded tickets, ownership and priority/status badges, search/filter results, and three responsive layouts. Queue API tests cover sorting, pagination, invalid queries and role restrictions; browser tests cover navigation, no-results and visual behavior.", st["body"])
    add_gallery(story, "staff-queue", st, "6")

    part(story, 7, "Working IT Staff Ticket Detail UI", st)
    add_text(story, "The detail screens show unclaimed and post-action states across viewports. Ownership, IT Priority, permitted status changes, Public Comments, Internal Notes, attachments and Requester resolution signaling are covered by linked API/UI/E2E tests.", st["body"])
    add_gallery(story, "staff-ticket-detail", st, "7")
    story.append(PageBreak())
    add_text(story, "Direct API authorization evidence follows. The 404 for another Requester's Ticket is intentional existence masking (BR-32), not an endpoint failure.", st["h2"])
    add_code(story, (ROOT / "artifacts/lab-03/curl-transcripts-i7.txt").read_text(encoding="utf-8").splitlines())

    part(story, 8, "Working Administrator User Management UI", st)
    add_text(story, "The list and create/edit dialogs are shown at desktop, tablet and mobile sizes. Admin API/UI/E2E tests verify create, search, edit, initial-password reset, duplicate-email/invalid-input handling, self-deactivation and last-Administrator safety, and non-Admin rejection.", st["body"])
    add_gallery(story, "user-management", st, "8")

    part(story, 9, "Zen Green UI and Responsive Evidence", st)
    add_text(story, "The galleries in Parts 5-8 contain the desktop/tablet/mobile variants for every major Lab 3 screen. The rendered UI specification below includes the completed visual checklist; VIS-01-VIS-06 document the computed-color, focus, clipping, overflow and responsive browser assertions.", st["body"])
    add_text(story, "UI specification source: [ui-spec.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-03/ui-spec.md).", st["small"])
    render_markdown(story, ROOT / "docs/lab-03/ui-spec.md", st)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    document = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=43, bottomMargin=46, title="CPE 334 Lab 3 TokTickIT Submission", author="Garunyapas Danpitakkul")
    frame = Frame(44, 46, A4[0] - 88, A4[1] - 89, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    landscape_size = landscape(A4)
    wide_frame = Frame(44, 46, landscape_size[0] - 88, landscape_size[1] - 89, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    document.addPageTemplates([
        PageTemplate(id="normal", frames=[frame], onPage=on_page, pagesize=A4),
        PageTemplate(id="landscape", frames=[wide_frame], onPage=on_page, pagesize=landscape_size),
    ])
    document.build(story)
    print(f"Created {OUT}")
    print(f"Mode: {'final' if final else 'draft'}; missing post-merge evidence: {len(missing)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--final", action="store_true", help="Fail unless all post-merge evidence exists")
    args = parser.parse_args()
    build(args.final)
