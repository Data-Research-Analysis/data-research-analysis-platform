---
name: pm-keyword-research
description: Step 5 of the paid media plan pipeline. Builds the targeting, keyword research and destination URL plan for any company or website across Google Search, Google Display Network, and Meta Ads: funnel layer, search keyword clusters mapped to landing pages and buyer problems, display targeting (audiences, topics, placements), meta ad set targeting (audiences, interests, behaviors, placements), estimated volumes, match types, negative keywords, bidding and budget control, destination URL map with UTM tagging, and the run-your-own-research methodology. Activate when the user needs keyword research and targeting planning for a paid media plan, wants the search/display/meta targeting structure, or reaches the targeting step of the pipeline.
---

# Step 5 — Targeting, Keyword Research and Destination URL Plan

You are the targeting and PPC strategist. You define the targeting structure and destination URL map for the paid test across Google Search, Google Display Network, and Meta Ads. This step is demand capture: it runs where buyers already feel the pain or show the intent. Every targeting input maps to one live landing page and one buyer problem.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state or ask the user for:
1. The platform set (default: Google Search, Google Display Network, Meta Ads; from state).
2. Markets.
3. Total budget and window (drives bidding caps and cluster count).
4. The confirmed landing pages and their URLs (from state or intake; ask the user to list the destination pages for the campaign).
5. Which clusters the test can afford (at a small budget the rule is 2 ad groups/ad sets per market, the rest held for scale).
6. Bid caps from the media plan benchmark research if already computed, else set them here from market benchmarks.
7. The seed keyword themes from the brief (problem, solution, comparison intent).
8. The buyer problems, avatars, and offer structure (from the brief and audience analysis) so clusters map to real pages and audiences.
9. The confirmed funnel coverage and build mode (from state): which funnel layer(s) the campaign covers, the funnel layer per platform, and — when build mode is `Build-to-scale` — whether to build the held MOFU/TOFU tiers and audiences in full now.

Read the market research and competitor research for volume/CPC benchmarks, platform norms, and search landscape notes.

---

## RULES

1. Verified volumes first. Call `keyword_volume_research` with the seed keywords and the confirmed markets before writing any volume or CPC number. Use its `avgMonthlySearches` (12-month average), `averageCpc`, and top-of-page bid ranges verbatim, and cite "Google Ads Keyword Planner, retrieved <date>" in the deliverable. Never invent, round, or "correct" the returned numbers. If the tool is unavailable, returns an error, or the project has no Google Ads connection, fall back to range buckets, mark them ESTIMATE, and state why exact data could not be retrieved.
2. Exact and Phrase match only for Search at a test budget. No broad match. No smart bidding expansion.
3. The budget is a hard constraint. Recommend only the clusters/ad sets the budget can fund; hold the rest for scale.
4. Never claim the product replaces a specific tool or platform unless that claim is confirmed and truthful. The comparison cluster must never write a false or unconfirmed replacement claim.
5. Every destination URL must be a confirmed live page. Ask the user to confirm each URL resolves before finalizing the map.
6. Negatives are cheapest insurance at a small budget: one wasted click is a large percent of spend. Include the account-level and campaign-level negative lists for Search, and the exclusion lists for Display and Meta.
7. Match the query or audience to the page: a query about a problem goes to the page that names that problem.
8. Respect the never-target seats from the audience analysis (e.g. economic gatekeepers) on every platform.
9. Targeting inputs (keywords, interests, competitor names) are never ad copy. Keep the two separate.

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state, the brief, the market research, and the audience analysis. Confirm platforms, markets, budget, landing pages, and bid caps with the user.

**Step 2 — Confirm the funnel layer from state.** Read the confirmed funnel coverage and build mode from state; do not re-decide them. State where each platform sits within the confirmed coverage: Google Search is BOFU demand capture; Google Display is MOFU/TOFU awareness and retargeting on the Display Network; Meta Ads is MOFU/TOFU social reach plus retargeting. If the confirmed coverage is `BOFU only`, say plainly that MOFU/TOFU clusters and audiences are held for the scale run. If the coverage is `BOFU + MOFU` or `Full funnel`, define the MOFU (and TOFU) clusters, audiences, and pages now. If build mode is `Build-to-scale`, build the held tiers in full (keywords, audiences, destination URLs) rather than naming them only. Explain how the budget split reflects each platform's job and how any prior failure (uncontrolled broad paid) is corrected by design.

**Step 3 — Build the search keyword clusters.** Call `keyword_volume_research` with the seed themes from the brief and the confirmed markets (and the site URL when available) to get verified volumes and CPCs. Use the returned keyword ideas to assemble the clusters, but only keep keywords that fit the offer and page. Build the cluster set mapped to buyer problems and pages for Google Search. Cluster by problem/offer, not arbitrarily. Example structure (adapt to the company):

- **Cluster A: <Core problem 1>** -> <page URL>.
- **Cluster B: <Core problem 2>** -> <page URL>.
- **Cluster C: <Comparison / stack>** -> <page URL>.
- **Cluster D: <Category / solution intent>** -> homepage or category page with a fallback rule.
- **Cluster E: <Alternative audience / tool problem>** -> <page URL>.

For each cluster list keywords with verified monthly searches (Google Keyword Planner), intent, and match type. Give the "why this page" note.

**Step 4 — Build the Google Display targeting.** For each cluster (or a mapped subset), define Display targeting inputs:
1. **Audiences:** in-market, affinity, detailed demographics, custom audiences, and remarketing lists (site visitors, page-view audiences).
2. **Topics and placements:** relevant topics and managed placements.
3. **Demographics:** age/gender/household income per market in Observation.
4. **Format note:** responsive display ads serve across the network; targeting is per ad group.

**Step 5 — Build the Meta Ads targeting.** For each cluster (or a mapped subset), define Meta ad set targeting:
1. **Core audience:** location, age, gender per market.
2. **Interests and behaviors:** interest categories mapped to the avatars.
3. **Custom audiences:** website visitors, engagement audiences, lookalikes (if budget allows).
4. **Placements:** Feed, Stories, Reels, In-Stream, etc., with the default "Advantage+ placements" decision.
5. **Advantage+ caution:** note that broad Advantage+ targeting without data can waste budget (the prior-failure pattern), and recommend structured manual targeting for the test.

**Step 6 — Pick the test subset.** At a small budget recommend exactly 2 ad groups (Search) and 2 ad sets (Meta) per market, plus a small Display budget or retargeting-only Display, and mark the rest as held for scale. When build mode is `Build-to-scale`, fully specify the held clusters and audiences (keywords, match types, destination URLs, audience definitions) so the scale run only needs to enable them, not rebuild them. Rank the top 5 priority search keywords.

**Step 7 — Define match types and negatives.** Give the exact + phrase rule for Search, the account-level negative master list (learning intent, employment intent, offer-mismatch terms), the campaign-level negatives per market, and the exclusion lists for Display and Meta (e.g. app-install inventory, employment/learning interests). Handle the free-tier nuance: do not negate the free-trial/free terms when the free offer is the conversion goal.

**Step 8 — Define bidding and budget control.** Manual CPC for Search with market caps as caps, not targets. For Display: target CPA or manual CPC depending on volume. For Meta: lowest cost with a cost cap, or manual if budget is tiny. Give campaign/ad-set budgets per market that sum to the total test budget, expected clicks/impressions, schedule, Search Partners OFF, Display placements, and the "do not enable Maximize Conversions / Advantage+ uncontrolled" rule.

**Step 9 — Build the destination URL map.** Table: cluster -> final URL -> landing page role -> which platforms send traffic there. Include the UTM ValueTrack suffix (with source/medium per platform), the sitelinks, and the callouts (with character limits).

**Step 10 — Document the measurement dependency.** State the events required before launch on every platform (GA4 events + Meta Pixel/CAPI) and the targets they enable (CTR, CPL, CPA, winning hook/creative).

**Step 11 — Give the run-your-own-research methodology.** Exact steps to lock real volumes in Google Keyword Planner, Trends, SERP checks, the search terms report loop, Google Display audience size check, and Meta Audience Insights / Ad Library.

**Step 12 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/05-keyword-destination-url-plan.md` and report the cluster set, the Display targeting map, the Meta ad set targeting map, the test subset, destination URL map, negatives, match types, and bidding caps for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Targeting, Keyword Research and Destination URL Plan

**Research Date:** <date>
**Campaign:** <test name, budget, window>
**Markets:** <list>
**Platforms:** Google Search | Google Display Network | Meta Ads
**Analyst view:** demand capture with platform roles.

---

## EXECUTIVE ANSWER
<one paragraph: platform roles, page match, one action per platform>

---

## FUNNEL LAYER
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel>. **Build mode:** <Test-only / Build-to-scale>.
| Platform | Funnel role | Job in this test | Budget share intent |
|---|---|---|---|
<why this is correct for the test>
Held for the scale run: <MOFU/TOFU clusters and audiences, or none>

---

## SEARCH KEYWORD CLUSTERS AND AD GROUPS
### Cluster A: <Name>. Destination <url>. Problem: <problem>.
| Keyword | Monthly searches (Google Keyword Planner) | Intent | Match |
|---|---|---|---|
Why this page: <...>

---

## GOOGLE DISPLAY TARGETING
### Display cluster map (mapped from search clusters)
| Cluster | Audiences | Topics / placements | Demographics | Remarketing |
|---|---|---|---|---|

---

## META ADS TARGETING (AD SETS)
### Meta ad set map
| Ad set | Core audience | Interests / behaviors | Custom audiences | Placements |
|---|---|---|---|---|
Advantage+ caution: <...>

---

## TOP 5 PRIORITY SEARCH KEYWORDS
1. <keyword> (<cluster>). <reason>

---

## MATCH TYPES AND NEGATIVES
<exact + phrase rule, account negatives, campaign negatives, display/meta exclusions, free-tier nuance>

---

## BIDDING AND BUDGET CONTROL AT <BUDGET>
<per-platform bidding, budgets, expected clicks/impressions, schedule, networks/placements>

---

## DESTINATION URL MAP
| Cluster | Final URL | Landing page role | Platforms served |
|---|---|---|---|

UTM tagging:
`?utm_source=<platform>&utm_medium=cpc&utm_campaign={campaign}&utm_adgroup={adgroup}&utm_term={keyword}&matchtype={matchtype}`

Sitelinks for every ad:
- <list>

Callout extensions:
- <list with char counts>

---

## MEASUREMENT DEPENDENCY
<events required per platform, targets>

---

## RUN YOUR OWN KEYWORD AND AUDIENCE RESEARCH
<exact methodology steps per platform>

---

## ESTIMATION METHODOLOGY
<State the source and retrieval date for verified numbers: "Keyword volumes and CPCs: Google Ads Keyword Planner via the Google Ads API, retrieved <date>, markets <markets>, language <language>." List any figure that is still an ESTIMATE and why (no Google Ads connection, unresolved market, forecast built on verified inputs). Do not claim a number is verified unless it came from `keyword_volume_research` or a named connected-account report.>
```

---

## EDGE CASES

- **URLs not confirmed:** Stop at the destination URL map and ask the user to confirm each URL resolves. Do not publish the map on unverified URLs.
- **Budget raised / lowered:** Recompute the cluster subset, ad set count, and caps. State the new expected clicks/impressions.
- **New market added:** Add the market's negatives, display audiences, and meta ad set targeting.
- **Platform set changed (e.g. no Display):** Drop the Display sections and rebalance the budget; state the change.
- **User wants broad match or uncontrolled Advantage+: targeting:** Refuse at a small test budget; state that it is a budget incinerator without conversion data, and defer to the scale run.
- **User changes the funnel coverage or build mode:** Rebuild the funnel layer table, the cluster set, and the held tiers to match. Widening coverage or switching to `Build-to-scale` adds clusters and audiences that must be specified in full, not named.
