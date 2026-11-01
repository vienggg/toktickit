"""Build the single Lab 4 submission PDF from the repository evidence.

Run from the repository root (ReportLab and Pillow installed). Reuses the Lab 3
builder helpers. The PDF is written to output/pdf and is not committed.
"""

from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate, PageTemplate, Paragraph, Spacer

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("lab3", ROOT / "docs/lab-03/build_report.py")
lab3 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lab3)

OUT = ROOT / "output" / "pdf" / "report_lab04_67070503404.pdf"
SHOTS = ROOT / "artifacts/lab-04/report-screens"
APP = ROOT / "artifacts/lab-04/screenshots"
TESTS = ROOT / "artifacts/lab-04/test-output"
CROPS = ROOT / "tmp/pdfs/crops4"

STORY: list = []
ST: dict = {}


def on_page4(canvas, doc):
    canvas.saveState()
    w, h = canvas._pagesize
    canvas.setFillColor(lab3.GREEN)
    canvas.rect(0, h - 9, w, 9, fill=1, stroke=0)
    canvas.setFont("Poppins-Medium", 7.5)
    canvas.setFillColor(lab3.MUTED)
    canvas.drawString(44, 29, "CPE 334  /  LAB 4  /  TOKTICKIT")
    canvas.drawRightString(w - 44, 29, f"{doc.page}")
    canvas.restoreState()


def fig(path: Path, caption: str, wide: bool = False, new_page: bool = False) -> None:
    lab3.figure(STORY, path, caption, ST, wide=wide, new_page=new_page)


def segments(path: Path, caption: str, x0=20, x1=760, step=1000, prefix="") -> None:
    """Cut a tall full-page screenshot into legible segments, one figure each."""
    CROPS.mkdir(parents=True, exist_ok=True)
    with PILImage.open(path) as src:
        w, h = src.size
        starts = list(range(0, h, step))
        for i, top in enumerate(starts, 1):
            dest = CROPS / f"{prefix}{path.stem}-{i}.png"
            src.crop((x0, top, min(w, x1), min(h, top + step + 20))).save(dest)
            suffix = f" (part {i}/{len(starts)})" if len(starts) > 1 else ""
            cw, ch = min(w, x1) - x0, min(h, top + step + 20) - top
            scale = min(507 / cw, 715 / ch)
            img = Image(str(dest), width=cw * scale, height=ch * scale)
            img.hAlign = "CENTER"
            STORY.append(KeepTogether([img, Spacer(1, 5), Paragraph(lab3.inline_markdown(caption + suffix), ST["caption"])]))


def text_file(path: Path, title: str) -> None:
    lab3.add_text(STORY, title, ST["h2"])
    lab3.add_code(STORY, path.read_text(encoding="utf-8", errors="replace").splitlines())


def gallery(folder: str, prefix: str) -> None:
    STORY.append(NextPageTemplate("landscape"))
    for n, p in enumerate(sorted((APP / folder).glob("*.png")), 1):
        label = p.stem.removeprefix("Figure-").replace("@", " - ").replace("-", " ")
        fig(p, f"Figure {prefix}.{n}: {label.capitalize()}.", wide=True, new_page=True)
    STORY.append(NextPageTemplate("normal"))


def git(*args: str) -> list[str]:
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    return r.stdout.splitlines()


def text(line: str, style: str = "body") -> None:
    lab3.add_text(STORY, line, ST[style])


def build() -> None:
    global ST
    lab3.register_fonts()
    ST = lab3.styles()
    S = STORY
    part = lambda n, t: lab3.part(S, n, t, ST)  # noqa: E731
    S.append(Spacer(1, 64))
    text("CPE 334 | Lab 4 submission report", "cover")
    text("TokTickIT - Actions Taken, Ticket Workflow and Role Dashboards", "h1")
    for line in [
        "**Author:** Garunyapas Danpitakkul, 67070503404, [@vienggg](https://github.com/vienggg)",
        "**Reviewer of my PRs:** Phuttipong Phankitnirundorn, 67070503430, [@projectnewy](https://github.com/projectnewy)",
        "**Peer I reviewed:** Dechayut Panyawutvorakul, 67070503414, [@NinjoMUDA](https://github.com/NinjoMUDA), PRs #47-#51 of [NinjoMUDA/Dechayut_3414Lab1](https://github.com/NinjoMUDA/Dechayut_3414Lab1)",
        "**Repository:** [github.com/vienggg/toktickit](https://github.com/vienggg/toktickit)",
        "**Kanban:** [TokTickIT Kanban](https://github.com/users/vienggg/projects/1)",
        "**Release:** [PR #92](https://github.com/vienggg/toktickit/pull/92) (lab4-staging to main); tag `lab4-release`",
    ]:
        text(line)

    # ---------------- Part 1
    part(1, "Git Use with Engineering Workflow")
    text("Nine issues (#75-#83), each with its own branch (`gh issue develop`) and a PR into `lab4-staging`. Phut's AI reviewed and merged every PR; I never merged my own. Review fixes went on the same branch. Release: lab4-staging to main in PR #92, then tag `lab4-release`. Limitation: issue #82 shows its PR but not its branch in the Development panel, because the branch already existed when I tried to link it (`gh issue develop` returned an empty branch name).")
    text("Commit graph of `main` (`git log --graph --oneline --decorate`):", "h2")
    lab3.add_code(S, git("log", "--graph", "--oneline", "--decorate", "-n", "48", "origin/main"))
    fig(SHOTS / "kanban-all-done.png", "Figure 1.1: Final GitHub Project board, every Lab 4 issue in Done.", wide=True)
    text("Phut's reviews on my PRs, with the changes-requested round on PR #86 (migration 5 missing five foreign keys), my replies and the approvals:", "h2")
    for n in range(84, 93):
        segments(SHOTS / f"phut-reviews/PR-{n}.png", f"Figure 1.{n - 82}: PR #{n} conversation, reviewer @projectnewy.")
    text("My reviews of Ninja's PRs (Dechayut_3414Lab1). I requested changes on #47, #48 and #51 and approved after the fixes; #49 and #50 were approved:", "h2")
    for n in range(47, 52):
        segments(SHOTS / f"ninja-prs/Ninja-PR-{n}.png", f"Figure 1.{n - 37}: Ninja PR #{n}, reviewer @vienggg.")
    text("README and .gitignore evidence:", "h2")
    lab3.add_code(S, ["# README.md (first 40 lines)"] + (ROOT / "README.md").read_text(encoding="utf-8").splitlines()[:40])
    lab3.add_code(S, ["# .gitignore"] + (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines())
    text("Repository directory structure (tracked files, two levels):", "h2")
    tree = sorted({"/".join(p.split("/")[:2]) + ("/" if p.count("/") >= 2 else "") for p in git("ls-files") if not p.startswith("artifacts/lab-0")})
    lab3.add_code(S, tree[:120] + ["artifacts/lab-03/, artifacts/lab-04/  (screenshots, test output, migration rehearsal)"])
    text("Source of the review log: [reviewer.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-04/reviewer.md), rendered next.", "small")
    lab3.render_markdown(S, ROOT / "docs/lab-04/reviewer.md", ST)

    # ---------------- Part 2
    part(2, "Spec DD")
    text("The engineering contract (PR #84) merged on 2026-10-31 17:12:49 UTC, before any implementation PR: #86 data model 18:05:46, #87 API 18:16:20, #88 UI 18:32:29, #89 dashboards 2026-11-01 05:54:56, #90 hardening 05:55:27, #91 responsive 06:27:35 (from `gh pr view --json mergedAt`).")
    text("Source: [specification.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-04/specification.md); PR [#84](https://github.com/vienggg/toktickit/pull/84).", "small")
    lab3.render_markdown(S, ROOT / "docs/lab-04/specification.md", ST)
    lab3.render_markdown(S, ROOT / "docs/lab-04/api-spec.md", ST)

    # ---------------- Part 3
    part(3, "Test DD and Traceability")
    text("Output below was produced from `main` after the release merge. The signed-out `GET /api/auth/me` 401 in the browser console is by design (Lab 3 API-07/15) and is the only console message the E2E tests ignore.")
    for name in ("server-main.txt", "client-main.txt", "playwright-main.txt"):
        text_file(TESTS / name, f"Command output: {name}")
    text("Source: [tests.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-04/tests.md).", "small")
    lab3.render_markdown(S, ROOT / "docs/lab-04/tests.md", ST)

    # ---------------- Part 4
    part(4, "AI Use with Reflection")
    text("Source: [ai-use.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-04/ai-use.md).", "small")
    lab3.render_markdown(S, ROOT / "docs/lab-04/ai-use.md", ST)

    # ---------------- Part 5
    part(5, "Working IT Staff Dashboard UI")
    text("Staff and Administrator dashboards at desktop, tablet and mobile. Cards link to filtered queues (drill-down). The staff API answers 403 to a Requester. Loading, empty, forbidden and safe-failure states are covered by DASH and UI tests (Part 3).")
    text_file(SHOTS / "db/dashboard-vs-db.txt", "Selected metrics match direct database queries")
    gallery("staff-dashboard", "5")

    # ---------------- Part 6
    part(6, "Working Actions Taken UI")
    text("Different Actions Taken on one ticket: create with an assignee, start, complete with a result, cancel (terminal), validation, role restrictions, and the API rejection of inactive assignees.")
    caps = {
        "01": "A new action assigned to another IT staff member.",
        "02": "The action listed with its assignee.",
        "03": "The action started (In progress).",
        "04": "The action completed with a result.",
        "05": "A second action cancelled; locked and read-only (terminal state).",
    }
    for k, c in caps.items():
        p = next((SHOTS / "app").glob(f"{k}-*.png"))
        segments(p, f"Figure 6.{int(k)}: {c}", x0=0, x1=1000, step=950, prefix="app-")
    fig(next((SHOTS / "app").glob("08-*.png")), "Figure 6.6: Requester sees every action read-only, no controls.")
    fig(next((SHOTS / "app").glob("09-*.png")), "Figure 6.7: Requester sent away from the staff ticket page.")
    text_file(SHOTS / "db/auth-and-assignee-curl.txt", "Inactive assignee, role restrictions and masking (API transcript)")
    gallery("actions-taken", "6.8")

    # ---------------- Part 7
    part(7, "Working Ticket Workflow")
    text("Permitted transitions only (the select offers just the allowed next statuses), the resolution gate (BR-19) blocking Resolved without a completed action, reopen needing a reason, and the append-only Status History in stable order.")
    for k, c in (("10", "Status In progress recorded in the history."), ("11", "Open action: Resolved is not offered (resolution gate)."), ("12", "Resolved after a completed action."), ("13", "Reopened with a reason; three history rows in order.")):
        p = next((SHOTS / "app").glob(f"{k}-*.png"))
        segments(p, f"Figure 7.{int(k) - 9}: {c}", x0=0, x1=1000, step=950, prefix="wf-")

    # ---------------- Part 8
    part(8, "Working Requester Dashboard and Final Regression UI")
    text("The Requester dashboard shows only the caller's tickets; a ticket owned by someone else answers 404 (BR-04, Part 6 transcript). Regression evidence: the full Lab 1-3 suites run from main (Part 3) and the Lab 3 screens for authentication, queue, ticket detail and user management.")
    gallery("requester-dashboard", "8")
    S.append(NextPageTemplate("landscape"))
    n = 6
    for folder in ("authentication", "staff-queue", "staff-ticket-detail", "user-management"):
        for p in sorted((ROOT / "artifacts/lab-03/screenshots" / folder).glob("*@desktop.png"))[:2]:
            n += 1
            nm = p.stem.removeprefix("Figure-").split("@")[0].replace("-", " ")
            fig(p, f"Figure 8.{n}: Lab 3 regression, {folder} ({nm}).", wide=True, new_page=True)
    S.append(NextPageTemplate("normal"))

    # ---------------- Part 9
    part(9, "Zen Green UI, Responsive, Accessibility and Final Polish")
    text("Desktop, tablet and mobile screenshots of every Lab 4 screen are in Parts 5, 6 and 8. Inspection results (V-01 to V-17: overflow, touch targets, keyboard focus, labels, reduced motion, console errors) are in section 9.1 of the UI specification below. V-12 (contrast) was not measured and is marked so. Source: [ui-spec.md](https://github.com/vienggg/toktickit/blob/main/docs/lab-04/ui-spec.md).")
    lab3.render_markdown(S, ROOT / "docs/lab-04/ui-spec.md", ST)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=43, bottomMargin=46, title="CPE 334 Lab 4 TokTickIT Submission", author="Garunyapas Danpitakkul")
    frame = Frame(44, 46, A4[0] - 88, A4[1] - 89, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    ls = landscape(A4)
    wide = Frame(44, 46, ls[0] - 88, ls[1] - 89, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="normal", frames=[frame], onPage=on_page4, pagesize=A4),
        PageTemplate(id="landscape", frames=[wide], onPage=on_page4, pagesize=ls),
    ])
    doc.build(S)
    print(f"Created {OUT}")


if __name__ == "__main__":
    build()
