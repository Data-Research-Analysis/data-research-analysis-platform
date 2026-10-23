---
name: pm-client-presentation
description: Builds a concise, client-ready digital marketing strategy PowerPoint deck from a completed paid media plan. Compresses the market research, competitor research, audience analysis, and the media plan (budget allocation, campaign targets, and the financial forecast) from the plan pack into a polished 16:9 PPTX for the client. Activate when the user wants a client-facing strategy presentation, needs a PowerPoint deck summarizing a paid media plan, wants to present research findings plus the media plan and financial plan to a client, or asks for a marketing strategy deck after the plan pack is complete.
---

# Client Presentation Deck (PPTX)

You are the strategy presenter. You turn the completed paid media plan pack into a concise, client-ready PowerPoint deck: market research, competitor research, the company's own paid media audit, audience analysis, and the media plan (including targets and the financial plan). One deck, ~16-21 slides, every number sourced from the plan pack, designed to be presented as-is to the client.

---

## WHAT YOU NEED TO START

> **Input rule.** Read only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), the deliverables in `paid-media-plan-<company-or-website-slug>/`, and the company website. Never invent facts, volumes, or benchmarks. Everything on a slide must trace to a deliverable (or be marked ESTIMATE / NOT VERIFIED like the source did).

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first, then the deliverables that feed each section:

| Deck section | Source deliverable(s) |
|---|---|
| Title / meta (budget, markets, platforms, window) | `plan-state.md` CORE FACTS, `00-plan-index.md` |
| Executive summary | Brief at a glance + Step 10 summary + Step 14 pass/fail criteria |
| Market research | `02-market-research.md` (market sizing, macro, platform penetration, digital trends) |
| Competitor research | `03-competitor-paid-media-research.md` (landscape table, offer clusters, benchmarks) |
| Company own paid media audit | `03a-company-paid-media-audit.md` (per-platform verdicts ACTIVE / NOT DETECTED / UNVERIFIABLE, what the company is running, limitations) |
| Audience analysis | `04-audience-analysis-avatars.md` (avatar set, priorities, targeting map, never-target) |
| Media plan — strategy & allocation | `05-keyword-destination-url-plan.md` (funnel layer), `10-media-plan.md` Summary + Funnel Layer Allocation |
| Media plan — financial forecast | `10-media-plan.md` Financials + Assumptions |
| Targets & KPIs | `01-creative-brief.md` objectives, `10-media-plan.md`, `11-tracking-setup.md`, `14-results-review.md` |
| Next steps | `00-plan-index.md` NEXT ACTIONS, `09-landing-page-implementation.md`, `12/13` build/checklist, `14` review |

If a deliverable is missing (e.g. the pack stopped at Step 10), build the deck from what exists and note the gap in the Next Steps slide. Do not fabricate the missing sections.

---

## RULES

1. **Concise.** Maximum 21 slides. One message per slide. No more than 6 bullets per slide, bullets under ~110 characters. If a fact is not essential to a client decision, leave it out.
2. **Holistic.** The deck must compress the *entire* research: market, competitors, audience, and the media plan. Every section gets at least one slide; the executive summary ties them together.
3. **Traceable, never fabricated.** Every volume, rate, and benchmark must appear in the deliverables. Keep the same VERIFIED / ESTIMATE / NOT VERIFIED labels the sources used. Where a number is an estimate, say so once on the slide (or its footnote), not on every line.
4. **Numbers must reconcile.** Budgets sum to the total. Forecast totals match the media plan. CPL = cost / leads. If the pack is internally inconsistent, fix it in the deck with a footnote, do not silently change numbers.
5. **Client-facing tone.** No internal jargon (ad groups, RSAs, CAPI) without a plain-language gloss. No open risk hidden: the tracking gate and the "test, not profit forecast" nature must be stated honestly.
6. **Save deliverables as files.** The content JSON and the PPTX are written into the plan directory. Never answer only in chat.
7. **Build with the script.** Do not hand-assemble the PPTX in a REPL loop; write the content JSON, run `scripts/build_deck.py`, and iterate on the JSON.
8. **Cover the company's own paid activity.** The deck must include one slide (type `companypaid`) on the company's own paid media audit (Step 3A). Show the per-platform verdicts (ACTIVE / NOT DETECTED / UNVERIFIABLE) and what the company is currently running. If no verifiable information exists for a platform (or the whole audit is UNVERIFIABLE), state that explicitly on the slide — never omit the section and never imply "not running".
9. **State the funnel coverage and build mode.** The media plan section must name the funnel coverage (`BOFU only` / `BOFU + MOFU` / `Full funnel`) and the build mode (`Test-only` / `Build-to-scale`) from state, and the allocation table must carry the funnel layer per line. If the plan is `Build-to-scale`, note that the scale run enables the pre-built held assets rather than rebuilding them.

---

## WORKFLOW

### Step 1 — Read state and deliverables

Read `plan-state.md` and the section sources above. Extract the concise facts for each deck section. Note the verification labels of each headline number and the open questions / gates recorded in state.

### Step 2 — Write the deck content JSON

Create `paid-media-plan-<company-or-website-slug>/00-strategy-deck-content.json` following the schema below. The blueprint (16-21 slides):

| # | Slide type | Content (from where) |
|---|---|---|
| 1 | `title` | Campaign name, client, one-line positioning, meta chips (budget, markets, platforms, window) |
| 2 | `agenda` | 6 sections |
| 3 | `section` | 01 Executive Summary |
| 4 | `execsummary` | 3-4 headline stats + one holistic paragraph tying market → competitors → audience → plan → expected outcome |
| 5 | `section` | 02 Market Research |
| 6 | `statgrid` | Industry at a glance: market size, growth, platform penetration, company performance (2-6 stats, each VERIFIED-labelled) |
| 7 | `bullets` | Macro + digital trends and what they mean for the plan (AI search, signal loss, creative testing, video, OTA competition) |
| 8 | `section` | 03 Competitor Research |
| 9 | `table` | Competitive landscape: competitor × paid social / search / offer / sophistication (NOT VERIFIED cells labelled) |
| 10 | `twocol` | Battleground vs. the gap Delta/the company can exploit (offer clusters, cadence benchmark) |
| 11 | `companypaid` | Company's own paid media audit: platform × verdict × what they're running; state explicitly if no verifiable info |
| 12 | `section` | 04 Audience Analysis |
| 13 | `table` | Avatar set: name, demographics, frequency, priority, paid role |
| 14 | `statgrid` | Targeting rules: primary channel, prospecting vs retargeting, never-target seats, seed audiences |
| 15 | `section` | 05 Media Plan |
| 16 | `table` | Budget allocation & campaign structure: platform × funnel layer × budget × share × role × structure (sums to total) |
| 17 | `table` | Financial plan — forecast: platform × clicks × impressions × CTR × CPC/CPM × est. leads × CPL + TOTAL row (ESTIMATE footnote) |
| 18 | `bullets` | Targets & KPIs: conversion events, winner criteria, scale decision, tracking gate |
| 19 | `section` | 06 Next Steps |
| 20 | `nextsteps` | The path to launch: approve → confirm URLs → build tracking → build campaigns → launch → review |
| 21 | `closing` | Thank you + what the full pack supports |

Adjust the blueprint to the company's real structure (e.g. different platform set, more avatars), but keep it ≤ 21 slides and keep the required sections present (market, competitors, **company own paid audit**, audience, media plan).

**Content JSON schema** (consumed by `scripts/build_deck.py`):

```json
{
  "meta": {
    "client": "<company>",
    "campaign": "<test name>",
    "date": "<presentation date>",
    "prepared_by": "<agency / team>",
    "platforms": "<Google Search | Google Display Network | Meta Ads>",
    "budget": "<amount and currency>",
    "markets": "<markets>",
    "window": "<dates>"
  },
  "slides": [
    {"type": "title", "kicker": "Digital Marketing Strategy", "title": "...", "subtitle": "..."},
    {"type": "agenda", "title": "Agenda", "kicker": "Overview",
     "items": [{"num": "01", "heading": "Executive Summary", "desc": "..."}]},
    {"type": "section", "number": "01", "title": "Market Research", "subtitle": "..."},
    {"type": "execsummary", "title": "The Plan at a Glance", "kicker": "Executive Summary",
     "paragraph": "...", "stats": [{"value": "$250K", "label": "Test budget"}]},
    {"type": "bullets", "title": "...", "kicker": "...", "lead": "...",
     "bullets": ["...", "..."]},
    {"type": "table", "title": "...", "kicker": "...",
     "header": ["Col1", "Col2"], "rows": [["a", "b"]],
     "align": ["l", "r"], "col_widths": [2, 1], "footnote": "..."},
    {"type": "statgrid", "title": "...", "kicker": "...",
     "stats": [{"value": "$1.05T", "label": "...", "note": "source (VERIFIED)"}]},
    {"type": "twocol", "title": "...", "kicker": "...",
     "left": {"heading": "...", "bullets": ["..."]},
     "right": {"heading": "...", "bullets": ["..."]}},
    {"type": "companypaid", "title": "...", "kicker": "Company Paid Media Audit", "lead": "...",
     "header": ["Platform", "Verdict", "What the company is running"],
     "rows": [["Meta Ads", "ACTIVE", "..."], ["Google Search", "UNVERIFIABLE", "..."]],
     "footnote": "...", "note": "..."},
    {"type": "nextsteps", "title": "...", "kicker": "...", "items": ["..."]},
    {"type": "closing", "title": "Thank you", "subtitle": "..."}
  ]
}
```

Slide type notes:
- `statgrid` and `execsummary` stats are capped at 4 and 6 cards respectively.
- `table` cells wrap; give long-text columns a larger `col_widths` weight and keep rows to ~6 words per cell where possible. Header cells should be short (the renderer warns on overflow).
- `companypaid` is the company's own paid media audit slide: pass `rows` as `[platform, verdict, what they're running]` (verdict = ACTIVE / NOT DETECTED / UNVERIFIABLE) plus a `lead` and a `footnote`. If there is nothing verifiable, omit `rows` (or pass an empty list) and give a `note` — the renderer prints the "no verifiable information" message instead of an empty table.
- Keep `bullets` ≤ 6 and `nextsteps` ≤ 6 — the renderer flags overflow; if a warning appears, shorten the text, don't ignore it.

### Step 3 — Build the PPTX

Run the script from the skill directory (script path: `scripts/build_deck.py` relative to the skill base):

```powershell
python "<skill base>\scripts\build_deck.py" "paid-media-plan-<company-or-website-slug>\00-strategy-deck-content.json"
```

Default output: `paid-media-plan-<company-or-website-slug>/00-digital-marketing-strategy-deck.pptx`.

### Step 4 — QA the deck

1. The script prints overflow warnings, runs a hard bounds check (any shape outside the slide canvas fails the build), and reports the slide count. Fix every warning by shortening text in the JSON and rebuilding — do not ship a deck with cut-off or invisible text.
2. Re-verify numbers against the deliverables: budget sums, forecast totals, CPL math, and the CORE FACTS in state.
3. Re-open the file (`Presentation(path)`) to confirm it loads and count the slides. If a client machine has PowerPoint, optionally export a few slides to PNG to eyeball spacing.

### Step 5 — Report to the master / user

Report: the PPTX path, the content JSON path, slide count, the four sections covered, the verification labels carried over, and any gaps (missing deliverables, unresolved gates surfaced on the deck).

---

## OUTPUT — FILE PATHS

- `paid-media-plan-<company-or-website-slug>/00-strategy-deck-content.json` — editable content source (rebuild the deck from it anytime).
- `paid-media-plan-<company-or-website-slug>/00-digital-marketing-strategy-deck.pptx` — the client-ready presentation.

The plan directory is `paid-media-plan-<company-or-website-slug>/` (named after the company or website). If the master recorded a different `Plan directory:` in the state file, use that directory instead.

---

## EDGE CASES

- **Pack incomplete (stopped before Step 14):** Build the deck from the completed steps; on the Next Steps slide note the missing review/scale step as a pending item. Never invent the missing research.
- **A deliverable's number is NOT VERIFIED:** carry the label into the slide (or its footnote), exactly as the source did. The deck must be as honest as the research.
- **No verifiable company paid activity (Step 3A):** still include the `companypaid` slide. Show the platform verdicts as UNVERIFIABLE / NOT DETECTED and state plainly that no verifiable information was found — do not drop the slide or imply the company is inactive.
- **Budget / markets / dates changed after the pack:** use the newest values from state; if the media plan totals no longer sum, fix the deck tables with a footnote stating the change.
- **Platform set differs (e.g. no Display):** drop the Display rows from the allocation and financial tables, rebalance to 100%, and state the change in a footnote.
- **Client wants more depth:** the deck is deliberately concise — point the client to the full plan pack files listed in `00-plan-index.md` rather than expanding slides.
- **python-pptx unavailable:** report it and deliver the content JSON plus a markdown outline of the same 15-20 slides so the deck can be rendered when the library is available.
- **Skill runs standalone (no plan pack):** require at minimum the plan deliverables (or the raw research notes) for market, competitors, audience, and the media plan numbers — otherwise the deck would be fabricated. If they are not provided, stop and ask.
