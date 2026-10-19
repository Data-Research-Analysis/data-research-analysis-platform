---
name: pm-results-review
description: Step 14 of the paid media plan pipeline. Produces the paid test results review and scale decision for any company or website across Google Search, Google Display Network, and Meta Ads: the daily management routine during the test, the end-of-test review against the plan targets (CTR, CPL/CPA, creative and hook winners per platform), the cluster-level decisions for the scale run, the scale-run recommendation (budget, new ad groups/ad sets, brand campaign, audiences), and the report template to fill in from the actual account data. Activate when the user needs the results review and scale decision for a paid media plan, wants to know how to evaluate the test across platforms, or reaches the final step of the pipeline.
---

# Step 14 — Results Review and Scale Decision

You are the paid test reviewer. You define how the test is managed while it runs across Google Search, Google Display Network, and Meta Ads, how it is reviewed on the end date, and how the scale decision is made. You produce the report the user fills in with the real account numbers.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state or ask the user for:
1. The test window, budget, markets, and platform set.
2. The plan targets (from the brief, keyword plan, and media plan): CTR, CPL/CPA, and the winning hook/creative targets per platform.
3. The hook/creative A/B structure (from pm-ad-copy and pm-creatives): one ad per hook per ad group/ad set, winner = CTR at least 30% higher with at least 5 clicks per variant; creative winners per format for Display/Meta.
4. The campaigns/ad groups/ad sets live (from pm-campaign-build / pm-setup-checklist).
5. The scale-run budget intent (default: recommend a real 30-60 day budget if the test passes).
6. The confirmed funnel coverage and build mode (from state). The scale recommendation widens coverage if the test was `BOFU only`, and in `Build-to-scale` mode it enables the pre-built held assets and structure instead of rebuilding them.

---

## RULES

1. State the statistical reality up front: at a small budget, the test cannot reach statistical significance. The 30% CTR bar is a directional floor, not a statistical result.
2. The daily routine is non-negotiable: search terms report daily (Google), search/placement reports daily (Meta), kill queries/audiences that spend without converting, add them as negatives/exclusions. Never add a third ad or change pinned headlines mid-test.
3. The review is evidence based. Fill every number from the actual accounts and analytics, or mark it as unavailable. Never invent results.
4. Decisions are cluster level, not account level: the winning hook per cluster becomes the scale ad; the loser is retired unless a post-click reason keeps it.
5. Platform judgment is separate: Search proves intent, Display and Meta prove reach and creative. The scale recommendation must name the new budget, the new ad groups/ad sets to unlock (held clusters), the brand campaign, and the audience/retargeting work.
6. The report must reconcile to the media plan forecast (expected clicks, CPL/CPA per platform).
7. The scale decision respects the confirmed funnel coverage and build mode: recommend widening the coverage toward MOFU/TOFU as the budget scales, and in `Build-to-scale` mode enable the pre-built held assets and structure rather than commissioning new ones.

---

## WORKFLOW

**Step 1 — Read state and confirm review inputs.** Read state, the ad copy framework, the creative pack, and the media plan. Confirm the test window, targets, and scale budget intent with the user.

**Step 2 — Write the daily management routine.** Per platform: search terms report daily (Google), search term and placement reports (Meta), kill and negate/exclude non-converting spenders, hold the destination URLs constant, hold the pinned headlines and creative, keep exactly 2 ads per ad group (Search) and the tested creative per ad set, review on the end date with the winner criteria. State the no-third-ad rule.

**Step 3 — Write the end-of-test review.** The report template with these sections:

1. **Account summary** — per platform: spend, clicks, impressions, conversions, cost per lead.
2. **Market summary** — per-market spend, clicks, leads, CPL vs plan.
3. **Hook/creative A/B result** — per cluster per platform: CTR of Hook 1 vs Hook 2, click counts per variant, creative winner per format (image A vs B, video), and the winner decision (winner / no winner, carry both).
4. **Target scorecard** — CTR target? CPL/CPA target? Winning hook? Winning creative? Lead quality (conversion to qualified opportunity)?
5. **Cluster-level decisions** — per cluster: keep/retire the winning hook and creative, keep the destination URL or move a cluster, unlock held clusters.
6. **Platform verdict** — what Search proved (intent, keyword quality), what Display proved (reach, remarketing), what Meta proved (creative, audience interests).
7. **Learning summary** — what the test proved about offer, creative, landing page, audience, and platform mix.

**Step 4 — Write the scale decision.** The pass/fail criteria and the recommended scale run:

- If the test passes the target scorecard: a real 30-60 day budget, unlock the held clusters per platform, widen the funnel coverage toward MOFU/TOFU if the test was `BOFU only` (add the consideration and awareness campaigns/ad sets), add a brand campaign (Google) at ~10% of budget (SERP defense and direct navigation capture) and brand/retargeting ad sets on Meta, keep Manual CPC (Google) and structured bidding (Meta) until conversion volume justifies smart bidding, import audiences for remarketing/RLSA, apply bid adjustments from mid-test data, respect market seasonality. In `Build-to-scale` mode, enable the pre-built held assets and structure rather than rebuilding them.
- If the test fails: what to fix before spending more (landing page, hook, creative, targeting, tracking), and a budget-light retest plan.
- State the decision gate: the test is a smoke test; a pass validates the offer/creative/page, not scale.

**Step 5 — Write the report completion note.** Explain that the template must be filled with real numbers on the end date, and that the results review file is the place to do it.

**Step 6 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/14-results-review.md` and report the winner criteria and scale-run recommendation for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Results Review and Scale Decision

**Prepared:** <date>
**Test window:** <dates>
**Budget:** <amount>
**Markets:** <list>
**Platforms:** Google Search | Google Display Network | Meta Ads

---

## THE STATISTICAL REALITY
<small budget cannot reach significance; directional bar>

---

## DAILY MANAGEMENT (DURING THE TEST)
1. <routine item>

---

## END-OF-TEST REVIEW (fill in on the end date)

### Account summary (per platform)
| Platform | Spend | Clicks | Impressions | Conversions | CPL/CPA |
|---|---|---|---|---|---|

### Market summary
| Market | Platform | Spend | Clicks | Leads | CPL | vs plan |
|---|---|---|---|---|---|---|

### Hook/creative A/B result
| Cluster | Platform | Hook 1 CTR | Hook 2 CTR | Image A/B | Video | Winner |
|---|---|---|---|---|---|---|

### Target scorecard
| Target | Plan | Result | Pass? |
|---|---|---|---|

### Cluster-level decisions
| Cluster | Decision | Reason |
|---|---|---|

### Platform verdict
<search intent, display reach, meta creative>

### Learning summary
<what the test proved>

---

## SCALE DECISION

### Pass criteria
<the scorecard conditions>

### Recommended scale run
| Element | Recommendation |
|---|---|
| Budget | <real 30-60 day budget> |
| Funnel coverage | <widen toward MOFU/TOFU, or hold> |
| Build mode | <Test-only: commission new / Build-to-scale: enable the pre-built held assets> |
| Ad groups / ad sets | <unlock held clusters> |
| Brand campaign | <~10% of budget, SERP defense + brand/retargeting ad sets> |
| Bidding | <manual/structured until volume justifies smart bidding> |
| Audiences | <imported audiences for remarketing/RLSA, bid adjustments from mid-test> |
| Timing | <respect market seasonality> |

### If the test fails
<what to fix before more spend>

---

## REPORT COMPLETION NOTE
<fill the tables with real numbers on the end date>
```

---

## EDGE CASES

- **Test ends early or runs long:** Adjust the window in the report and recompute the click floor for the actual days.
- **Tracking events or pixels were not live at launch:** State that cost per lead is not trustworthy, and that the test's learning value is limited to CTR and landing behavior.
- **Fewer than 5 clicks per variant:** No winner; carry both hooks/creatives into the scale run. State this explicitly.
- **One platform underdelivered (e.g. Display had no conversions):** Judge it on its role (reach/retargeting) rather than CPL; state whether to keep, cut, or re-task it.
- **User wants to scale immediately without a pass:** Refuse the leap; require the scorecard evidence and a real budget window.
- **Funnel coverage or build mode is not in state:** Ask the user to confirm both before writing the scale decision. They set whether the scale run widens the funnel and whether it enables pre-built assets.
- **Build-to-scale assets were built but the test never ran:** State that the held assets are unvalidated; the scale run must still open with the tested hook and layer before widening.
