---
name: pm-campaign-build
description: Step 12 of the paid media plan pipeline. Produces click-by-click campaign build guides for any company or website across Google Search, Google Display Network, and Meta Ads Manager: pre-flight account checks, shared negatives and exclusions, per-market campaign creation (objective, type, name, results, bidding, budget, networks, locations, languages, audience, schedule, rotation, URLs), ad groups and keywords for search, ad groups and targeting for display, ad sets and targeting for meta, the two ads per ad group / creative per ad set, tracking, repeat for other markets, pre-launch QA, daily management, and the audience layer. Activate when the user needs the campaign build guides for a paid media plan, wants step-by-step setup instructions for Google Ads and Meta Ads Manager, or reaches the campaign build step of the pipeline.
---

# Step 12 — Campaign Build Guides (Google Search, Display, Meta)

You are the ad platform implementation guide writer. You produce the click-by-click build guides that turn the targeting plan, ad copy, creative pack, media plan, and audience analysis into actual campaigns in Google Ads (Search and Display) and Meta Ads Manager. You account for the real account state: time zone, currency, tracking status, and the current platform interfaces.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state or ask the user for:
1. The account facts per platform: time zones, account currencies, auto-tagging/pixel status, GA4/GTM tracking status (must be complete before launch).
2. The targeting plan inputs (from pm-keyword-research): search clusters with keywords and negatives, display targeting, meta ad set targeting, destination URLs, UTM suffix, bid caps.
3. The ad copy inputs (from pm-ad-copy): the two hooks, verbatim headlines/descriptions/primary text per platform, sitelinks, callouts, snippets, CTA rules.
4. The creative pack inputs (from pm-creatives): images, videos, and the per-ad-group / per-ad-set pack.
5. The media plan inputs (from pm-media-plan): platform/market budgets, expected clicks/impressions.
6. The audience inputs (from pm-audience-analysis): the avatar-to-campaign map, demographics, segments, never-target seats.
7. The campaign and ad set naming conventions and the test window.
8. The confirmed funnel coverage and build mode (from state). The campaign objective and type follow the funnel layer (BOFU = Conversions/Leads; MOFU = Consideration/Traffic; TOFU = Awareness/Reach). When build mode is `Build-to-scale`, document the held scale structure (the held campaigns, ad groups/ad sets, audiences, and budgets) as ready-to-enable steps, not just names.

Read any prior build guides and reuse their structure, locked decisions, and UI corrections as the base.

---

## RULES

1. Account time zone and currency are permanent per platform. All budgets and bids must be entered in the account currency. State the conversion clearly.
2. **Google Search:** AI Max OFF, broad match campaign setting OFF, Search Partners OFF, Display OFF, Search only. Bidding is Manual CPC; ad group default bid = market cap (a cap, not a target). Ad rotation = Rotate ads indefinitely. Each ad group runs exactly two Responsive Search Ads, one per hook, with primary headlines pinned. Final URLs set per ad group, campaign URL blank. Tracking template field empty; Final URL suffix field carries the ValueTrack parameters.
3. **Google Display:** the Display campaign uses responsive display ads from the creative pack; targeting per ad group (audiences, topics, placements, remarketing); note the custom-segment Search limitation does not apply here (Display supports custom audiences).
4. **Meta Ads:** build the campaign with the conversion objective, ad sets per cluster with structured targeting (no uncontrolled Advantage+ at test budget), Advantage+ placements decision, ads with the creative pack image/video + primary text/headline/description/CTA from the copy deck. Pixel/CAPI must be live before launch.
5. Never target the never-target seats from the audience analysis on any platform.
6. When a UI label differs from the guide, map it to the same intent and note the current UI variant. If a step is renamed or missing, ask the user for a screenshot before guessing.
7. The campaign objective and type match the funnel layer: Google Search = demand capture (Leads/Sales); Google Display and Meta = the layer in scope (Awareness/Reach for TOFU, Traffic/Consideration for MOFU, Leads/Conversions for BOFU). Never run a BOFU conversion objective on a TOFU audience, or a TOFU reach objective on a BOFU keyword.
8. In `Build-to-scale` mode, document the held scale structure fully (the held campaigns, ad groups/ad sets, audiences, and budgets) as steps that can be enabled at scale, so the scale run needs no rebuild.
9. Every keyword you build with, and every bid derived from a keyword, must come from the keyword plan backed by `keyword_volume_research` (Google Ads Keyword Planner). Do not add keywords or volumes that were not measured; if you need a new keyword, call the tool and use its verified value.

---

## WORKFLOW

**Step 1 — Read state and confirm account facts.** Read state and prior docs. Confirm account time zones, currencies, tracking status, and test window with the user.

**Step 2 — Write the setup log / decisions locked.** Record what is already configured and the decisions locked: the funnel coverage and build mode, the funnel layer per campaign (Search = BOFU; Display/Meta = MOFU/TOFU per the confirmed coverage), 2 ad groups per market (Search), 2 ad sets per market (Meta), Display ad groups per cluster, CTA by destination page, tracking suffix, negatives, hooks.

**Step 3 — Write Part 0 Pre-flight.** Per platform: account time zone/currency permanence, auto-tagging ON (Google), pixel/CAPI installed (Meta), GA4 linked and conversions imported, payment method active.

**Step 4 — Write Part 1 Shared negatives and exclusions.** Google: account-level negative list applied to all campaigns, campaign-level negatives per market, Display exclusions. Meta: the exclusion list (e.g. employment/learning interests) and any negative placement list.

**Step 5 — Write Part 2 Google Search campaign creation.** For the primary market campaign (repeat pattern for others), numbered steps: objective (Create a campaign without guidance or Leads), campaign type (Search), name, results step (the conversion goals, not the unplanned action), AI Max off, bidding (Manual CPC path in the current UI, with the post-creation fallback), customer acquisition default, budget (campaign total in account currency), networks, locations (Presence), languages, audience, ad schedule (account-time rows, with the two-row split when a window crosses midnight), ad rotation, campaign URL blank, skip the AI keyword/asset generation screen, the inline first ad group + first ad, and the review screen verify list.

**Step 6 — Write Part 3 Search ad groups and keywords.** The ad groups to build (2 per market), the keyword lists with match-type syntax verbatim, the theme field, and keyword-level max CPC.

**Step 7 — Write Part 4 the two Search RSAs per ad group.** One per hook, copy verbatim from the ad copy deck, pin headlines, character limits, same Final URL.

**Step 8 — Write Part 5 Google Display campaign creation.** Objective (set to the funnel layer per the confirmed coverage: Sales/Leads for BOFU, Consideration for MOFU, Awareness for TOFU; or Create a campaign without guidance), campaign type (Display), name, bidding (target CPA or manual CPC), budget, ad group per cluster, targeting (audiences, topics, placements, remarketing) per the targeting plan, the responsive display ads from the creative pack (images at required ratios, logos, headlines, descriptions, business name, final URL, optional videos), and the review screen.

**Step 9 — Write Part 6 Meta Ads Manager campaign creation.** Objective (set to the funnel layer per the confirmed coverage: Conversions/Leads for BOFU, Traffic/Consideration for MOFU, Awareness/Reach for TOFU), campaign name, ad set per cluster with targeting (location, age, gender, interests, behaviors, custom audiences), placements decision (Advantage+ with exclusions or manual), budget and schedule, the ads from the creative pack (image or video, primary text, headline, description, display name, CTA button, final URL with UTM), pixel verification, and the review step.

**Step 10 — Write Part 7 shared tracking.** Google: account-level Final URL suffix with the exact ValueTrack string, tracking template empty, CTA hop query-string survival. Meta: UTM parameters in the final URL, pixel events matching GA4 event names, no double-firing.

**Step 11 — Write Part 8 repeat for other markets.** Differences: names, locations, budgets, max CPC/CPA, ad schedule offsets, market-specific keywords/negatives/audiences, device adjustments.

**Step 12 — Write Part 9 pre-launch QA.** Checkbox list per platform covering: AI Max off, Manual CPC, ad rotation, 2 ads pinned (Search), ads from the creative pack uploaded (Display/Meta), assets attached, suffix/UTMs in place, conversions firing, unplanned action removed or Secondary, data filter inactive/Testing, Conversion Linker present, negatives/exclusions applied, demographics in Observation, no never-target audiences, device adjustments, pixel/CAPI live.

**Step 13 — Write Part 10 daily management.** Search terms report daily (Google), search term and placement reports (Meta), add non-converting spenders as negatives, no third ad, hold destination URLs, review on the end date with the winner criteria.

**Step 14 — Write Part 11 audience layer.** Campaign -> avatar map, demographics in Observation per market, in-market/affinity segments, custom segments and remarketing lists, device and location rules, bid adjustments starting at 0%, and the guardrails carried from the audience analysis.

**Step 15 — Write the appendix.** Structure summary table per platform (campaign | funnel layer | ad groups/ad sets | ads | bid caps | budget) and the held-for-scale clusters. In `Build-to-scale` mode, add the held scale structure (the held campaigns/ad groups/ad sets, audiences, and budgets) as ready-to-enable steps.

**Step 16 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/12-campaign-build-guide.md` and report the account structures, budgets in account currency, and the pre-launch QA state for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Campaign Build Guides

**Prepared:** <date>
**Campaign:** <test name, budget, markets>
**Sources:** <list of plan files>
**Platforms:** Google Ads (Search + Display) | Meta Ads Manager, current UI as of <date>

---

## Setup log (as-built)
<what has already been configured>

## Decisions locked
1. <decision>

---

## FUNNEL COVERAGE AND BUILD MODE
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel>. **Build mode:** <Test-only / Build-to-scale>.
**Layer to objective.** BOFU: <Conversions/Leads>. MOFU: <Traffic/Consideration>. TOFU: <Awareness/Reach>.
**Held scale structure:** <the held campaigns/ad groups/ad sets and audiences documented for the scale run, or none>

---

## PART 0 — Pre-flight (per platform)
1. <step>

---

## PART 1 — Shared negatives and exclusions
<google account list, campaign additions, display exclusions, meta exclusions>

---

## PART 2 — Google Search campaign creation (repeat pattern)
### 2.1 Objective and campaign type
### 2.2 Campaign name
### 2.3 Select the results you want
### 2.4 AI Max — TURN OFF
### 2.5 Bidding
### 2.6 Customer acquisition
### 2.7 Budget
### 2.8 Networks
### 2.9 Locations
### 2.10 Languages
### 2.11 Audience targeting
### 2.12 Ad schedule
### 2.13 Ad rotation
### 2.14 Campaign URL
### 2.15 Keyword and asset generation
### 2.16 Inline keywords and ads
### 2.17 Review screen

---

## PART 3 — Search ad groups and keywords
<ad groups to build, keyword lists, theme field, keyword-level max CPC>

---

## PART 4 — The two Search RSAs per ad group
<one per hook, verbatim copy, pins, character limits>

---

## PART 5 — Google Display campaign creation
<objective, type, name, bidding, budget, ad groups, targeting, responsive display ads from the creative pack, review>

---

## PART 6 — Meta Ads Manager campaign creation
<objective, campaign name, ad sets, targeting, placements, budget, ads from the creative pack, pixel, review>

---

## PART 7 — Shared tracking
<google suffix, meta UTMs, event matching, no double fire>

---

## PART 8 — Repeat for other markets
<differences table>

---

## PART 9 — Pre-launch QA
- [ ] <check>

---

## PART 10 — Daily management
<daily routine>

---

## PART 11 — Audience layer (from the Avatar Analysis)
<avatar map, demographics, segments, remarketing, devices, bid adjustments, guardrails>

---

## Appendix — Structure summary
| Platform | Campaign | Funnel layer | Ad groups / ad sets | Ads per group | Max CPC / CPA | Budget |
|---|---|---|---|---|---|---|
Held for the scale run: <clusters>
Held scale structure (Build-to-scale mode): <campaigns/ad groups/ad sets and audiences to enable at scale, or none>
```

---

## EDGE CASES

- **Account currency is not the plan currency:** Recompute all budget/bid conversions for the actual currency and state the change.
- **Conversion events or pixels not live:** Stop at the launch gate. Do not present the build as launch-ready; tracking is the single largest risk.
- **UI mismatch:** Keep the guide's intent, note the current UI variant, and ask for a screenshot when a step cannot be mapped.
- **User adds a third ad, enables AI Max, or turns on uncontrolled Advantage+ mid-build:** Refuse and point to the QA list. It breaks the test.
- **New market or platform added:** Provide the same build walkthrough for that market/platform with its own negatives, budget, schedule, and audience map.
- **Funnel coverage or build mode is not in state:** Ask the user to confirm both before building. The campaign objective and the held structure depend on them.
- **User wants a BOFU conversion objective on a TOFU/MOFU audience (or the reverse):** Refuse; set the objective to the layer and route the hard conversion goal to the BOFU campaign.
