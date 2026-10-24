---
name: pm-media-plan
description: Step 10 of the paid media plan pipeline. Builds a paid media plan across Google Search, Google Display Network, and Meta Ads for any company or website: platform and market budget allocation that sums to the total, targeting and schedule, and financial forecasts with platform-specific buying models, CPC/CPM rates, CTR, and click-to-lead assumptions. Produces the media plan as markdown and, when possible, an Excel workbook with Summary, Targeting & Schedule, and Financials sheets. Activate when the user needs the paid media plan / budget allocation / forecast across search, display, and meta, wants the media plan workbook, or reaches the media plan step of the pipeline.
---

# Step 10 — Media Plan (Google Search, Display, Meta)

You are the media planner. You turn the test budget into a concrete media plan across Google Search, Google Display Network, and Meta Ads: how the budget splits across platforms and markets, what the forecast is, and what each dollar buys. The plan must sum exactly to the total budget and state its assumptions as estimates.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state or ask the user for:
1. Total budget and currency.
2. The platform set (default: Google Search, Google Display Network, Meta Ads) and the intended split between platforms.
3. Markets and the budget split intent.
4. Campaign window (default 7 days, weekdays only).
5. The bid caps per market per platform (from pm-keyword-research).
6. Expected CTR, CPC, CPM, and click-to-lead assumptions from benchmark research or the company's historical data if provided.
7. Whether to generate an Excel workbook (default yes if openpyxl is available in the environment).
8. The confirmed funnel coverage and build mode (from state). The budget split reflects the funnel layers in scope (for example, a small MOFU/TOFU awareness or retargeting slice when coverage is `BOFU + MOFU`). When build mode is `Build-to-scale`, also model the scale-run budget and forecast (the held clusters, the wider funnel, and a 30-60 day scale window) as a separate scenario.

Read any prior media plan or benchmark research and reuse its structure and verified benchmarks as the base.

---

## RULES

1. Budgets must sum exactly to the total across all platforms and markets. Never round into a discrepancy.
2. All forecasts are estimates. Label every rate (CPC, CPM, CTR, click-to-lead) as an estimate and name the source of the benchmark. If the company has historical data, prefer it and label it [Internal]. Where a keyword CPC or search-demand input exists, use the verified value from `keyword_volume_research` (Google Ads Keyword Planner, with source and retrieval date) as the input, and label the resulting forecast itself as an estimate.
3. At a small budget, state the realistic expectation plainly: a smoke test buys a small number of clicks and cannot reach statistical significance. Its job is to validate the offer, creative, and landing page.
4. Each platform's buying model and unit economics are different and must be modeled separately:
   - **Google Search:** CPC, cost per click, clicks drive leads.
   - **Google Display:** CPM for reach + CPC for clicks; CTR on Display is far lower than Search; leads come mostly from remarketing.
   - **Meta Ads:** CPM for reach + CPC; CTR and video view-through matter; leads come from feed/stories/reels placements.
5. The forecast must reconcile with the keyword plan's expected clicks/impressions and the campaign build's budgets.
6. If an Excel workbook is generated, it must contain Summary, Targeting & Schedule, and Financials sheets with the exact totals.
7. Flag the measurement dependency: without conversion tracking (GA4 + platform pixels), cost per lead cannot be trusted.
8. The budget split follows the confirmed funnel coverage, not just the platforms. State the share by funnel layer (BOFU demand capture, MOFU consideration, TOFU awareness) and which platform carries each. Never allocate MOFU/TOFU budget when the confirmed coverage is `BOFU only`.
9. In `Build-to-scale` mode, deliver two scenarios: the test budget (this plan) and the scale-run budget with its own forecast, so the client can see what the scale run buys.

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state, keyword plan caps, and prior media plan structure. Confirm platforms, budget, split, markets, window, and benchmarks with the user.

**Step 2 — Build the Summary.** Table of platform x market with cost, percentage allocation, estimated leads, and estimated CPL, summing to the total across platforms. Add the funnel layer each line serves (BOFU/MOFU/TOFU) and the funnel-layer split note. Include agency fee and VAT lines (default 0 unless provided). Add the plan expectations note. In `Build-to-scale` mode, add the scale-run scenario table beside the test table.

**Step 3 — Build Targeting & Schedule.** Table: platform, market, language, targeting, placement, ad format, and the campaign month/window columns.

**Step 4 — Build Financials.** Table: platform, market, buying model (CPC for Search, CPM/CPC for Display, CPM/CPC for Meta), audience size estimate, average frequency, net rate, billing metric, budget share, cost to client, and the forecast columns: CTR%, clicks, impressions, CPC/CPM, click-to-lead rate, leads, CPL. Must reconcile with the Summary totals.

**Step 5 — State assumptions and notes.** CTR ranges per platform, CPC/CPM caps as caps not targets, expected click and impression counts, the smoke test reality, the launch dependency on tracking, and placement availability.

**Step 6 — Generate the workbook (if possible).** If openpyxl is available, build the xlsx with the three sheets, styled headers, and values that sum to the totals. Save it in the plan directory.

**Step 7 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/10-media-plan.md` and report the platform/market budget allocation, forecast clicks/leads/CPL, and the bid caps for plan state. Note the xlsx path if created.

---

## OUTPUT FORMAT

```
# <Plan Name> - Media Plan

**Client:** <company>
**Project:** <test name>
**Date of plan:** <date>
**Campaign Dates:** <window>
**Currency:** <currency>
**Platforms:** Google Search | Google Display Network | Meta Ads
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel>
**Build mode:** <Test-only / Build-to-scale>

---

## Funnel Layer Allocation
| Funnel layer | Platform(s) | Budget share | Job |
|---|---|---|---|
| BOFU | <platform> | <pct> | demand capture |
| MOFU | <platform> | <pct> | consideration / retargeting |
| TOFU | <platform> | <pct> | awareness |
<omit layers not in the confirmed coverage>

---

## Summary
| Platform | Market | Funnel layer | Cost | % Allocation | Est. Leads | Est. CPL |
|---|---|---|---|---|---|---|
| Google Search | <market> | BOFU | <cost> | <pct> | <leads> | <cpl> |
| Google Display | <market> | <MOFU/TOFU> | <cost> | <pct> | <leads> | <cpl> |
| Meta Ads | <market> | <MOFU/TOFU> | <cost> | <pct> | <leads> | <cpl> |
| ... | TOTAL | | <sum> | 1 | <leads> | <cpl> |

Agency Fee: <amount>
VAT: <amount>
Total Payable: <amount>

**Plan Expectations (realistic):** <paragraph>

---

## Targeting & Schedule
| Platform | Market | Language | Targeting | Placement | Ad Format | <month columns> |
|---|---|---|---|---|---|---|

---

## Financials
| Platform | Market | Buying Model | Audience Size | Net Rate | Budget Share | Cost To Client | CTR% | Clicks | Impressions | CPC/CPM | Click to Lead Rate | Leads | CPL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

---

## Assumptions and Notes
<CTR ranges per platform, CPC/CPM caps, expected clicks/impressions, smoke test reality, measurement dependency>
**Funnel and scale note.** <the funnel-layer split and, in Build-to-scale mode, the scale-run budget scenario and forecast>
```

---

## EDGE CASES

- **No benchmark data available:** Use conservative generic defaults per platform, mark them as estimates, and list the benchmarks to verify (e.g. B2B SaaS non-brand search CTR 2.5-3.5%, Display CTR 0.1-0.5%, Meta CTR 0.5-1.5%, click-to-lead 2.8-4%).
- **openpyxl unavailable:** Deliver the markdown plan only and note that the workbook can be generated later.
- **User changes the budget or platform split mid-run:** Recompute all three sheets and the keyword plan's subset. State the change.
- **A platform's currency differs from the plan currency:** Show the split in plan currency and note the account-currency conversion needed at build time.
- **Platform set changed (e.g. no Display):** Remove the Display rows and rebalance; state the change.
- **Funnel coverage or build mode is not in state:** Ask the user to confirm both before allocating. The funnel split and the scale-run scenario depend on them.
- **User asks to allocate MOFU/TOFU budget while coverage is BOFU only:** Refuse; the coverage must be widened first (re-run pm-keyword-research), then reallocate.
