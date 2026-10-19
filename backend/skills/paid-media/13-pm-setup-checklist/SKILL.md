---
name: pm-setup-checklist
description: Step 13 of the paid media plan pipeline. Produces campaign setup checklists for any company or website across Google Search, Google Display Network, and Meta Ads Manager as markdown and, when possible, an Excel workbook with How to Use, Campaign Checklist, Ad Group/Ad Set Checklist, Ad/Creative Checklist, Reference, and Summary sheets covering every campaign, ad group, ad set, and ad in the test. Activate when the user needs the campaign setup checklist for a paid media plan, wants to verify the Google Ads and Meta Ads builds, or reaches the checklist step of the pipeline.
---

# Step 13 — Campaign Setup Checklists (Google + Meta)

You are the QA checklist builder. You turn the campaign build guide, targeting plan, ad copy, and creative pack into complete verification checklists so the user can confirm every campaign, ad group/ad set, and ad is built exactly to the plan before and after launch.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Read the confirmed inputs from state: the campaign build guide (pm-campaign-build), the targeting plan (pm-keyword-research), the ad copy (pm-ad-copy), the creative pack (pm-creatives), and the media plan (pm-media-plan). Confirm or ask the user for:

1. The account facts per platform (time zones, currencies, budgets/bids in the account currency).
2. The Google Ads entity set: one campaign per market (Search), plus Display campaigns/ad groups; 2 ad groups per market with 2 RSAs each; Display ad groups per cluster with responsive display ads.
3. The Meta entity set: campaigns per market or objective; 2 ad sets per cluster; ads per ad set from the creative pack.
4. The destination URLs, budgets, bids, negatives/exclusions, assets, audiences, and verbatim copy from the source docs.
5. Whether to generate the Excel workbook (default yes if openpyxl is available).

Read any prior generator and reuse its structure and plan-vs-UI corrections as the base.

---

## RULES

1. Coverage is exhaustive: every campaign, ad group/ad set, and ad gets its own status column on every platform. No entity is omitted.
2. The checklist must embed the plan-vs-UI corrections:
   - Structured snippet headers are a fixed list; custom headers like "Data sources"/"Use cases" are NOT selectable. Use the closest allowed headers with 3-10 values each under the character limit.
   - Custom segments are NOT assignable to Search campaigns; they ARE supported on Display. Search supports In-market, Affinity, Detailed demographics, and Your data only.
   - Demographics live in a dedicated Demographics section (Observation) in Google Ads.
   - Device bid adjustments live under Insights and reports -> When and where ads showed -> Devices in Google Ads.
   - Meta: structured manual targeting for the test; uncontrolled Advantage+ targeting is a budget risk; Pixel/CAPI must be live.
3. Every expected value must be concrete (budgets and bids in the account currency, exact keyword syntax, exact copy, exact image/video asset names from the creative pack) so the user can verify without guessing.
4. Status values: Done / In Progress / Not Done / N/A / Needs Review, with color coding in the workbook.
5. The ad copy reference must be verbatim from the ad copy deck: the two hooks per cluster.
6. Include the guardrails as checklist items: no banned words, no exclamation marks/emojis/dashes, no unverified counts, only confirmed features, no competitor names in copy, no fabricated claims, never target the never-target seats.
7. Verify the funnel layer: each campaign's objective/type matches its funnel layer (BOFU = Conversions/Leads; MOFU = Traffic/Consideration; TOFU = Awareness/Reach), and in `Build-to-scale` mode the held scale assets and structure exist and are listed. Flag any objective that does not match its layer.

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state and source docs. Confirm account facts, entity sets, and workbook preference with the user.

**Step 2 — Write the How to Use sheet.** Purpose, scope (platforms, campaigns, ad groups/ad sets, ads), the sheets list, how to mark, status values, color code, order of work (campaign first, then ad groups/ad sets, then ads), and the source-of-truth references.

**Step 3 — Write the Campaign Checklist (Google).** One status column per campaign (Search and Display). Items grouped by category: Pre-flight (account), Structure and type (objective/type matches the campaign's funnel layer), Budget/dates/networks, Keywords and negatives (Search), Targeting (Display), Assets (campaign level), Audience layer, Tracking and QA. Include account-currency conversions, ad-schedule splits, unplanned-action removal, AI Max off, Manual CPC, ad rotation, snippet header correction, custom segment Search limitation, device adjustments.

**Step 4 — Write the Campaign Checklist (Meta).** One status column per Meta campaign. Items grouped by: Objective and type (must match the campaign's funnel layer), Name and structure, Budget and schedule, Targeting approach (structured, not uncontrolled Advantage+), Placements, Pixel/CAPI, Tracking.

**Step 5 — Write the Ad Group / Ad Set Checklist.** One status column per ad group (Search), per Display ad group, and per Meta ad set. Items grouped by: Structure, Keywords (exact syntax) / Targeting (audiences, interests, placements), Destination (final URL per cluster), Ads in group (exactly 2 RSAs per Search ad group; creative pack assets per Display ad group and Meta ad set).

**Step 6 — Write the Ad / Creative Checklist.** One status column per ad (Search: market x cluster x hook; Display: per creative pack asset; Meta: per ad). Items grouped by: Ad type and setup, Copy accuracy (verbatim, pins, character limits), Creative asset (correct image/video from the pack, ratios, captions, logo), CTA (matches destination page, exactly one), Guardrails (banned words, formatting, unverified counts, pricing, competitors, fabricated claims, AI-generation claim), Policy (approved, no missing fields).

**Step 7 — Write the Reference sheet.** The expected values to compare against: campaigns (budget/bid/location), ad groups/ad sets (destination URL, keywords, targeting), negatives and exclusions, assets (sitelinks, callouts, snippets with corrected headers), creative pack asset list, custom segments and their Search limitation, verbatim ad copy per cluster/hook, and guardrails.

**Step 8 — Write the Summary sheet.** Completion counts per campaign, ad group/ad set, and ad with formulas (COUNTIF on Done etc.) and a completion percentage.

**Step 9 — Generate the workbook (if possible).** If openpyxl is available, produce the xlsx with status dropdowns and conditional color formatting, styled headers, freeze panes, and the live Summary formulas. Save it in the plan directory.

**Step 10 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/13-setup-checklist.md` and report the checklist coverage and the xlsx path for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Campaign Setup Checklists

**Scope:** Google Search (N campaigns, N ad groups, N ads) + Google Display (N campaigns, N ad groups, N ads) + Meta Ads (N campaigns, N ad sets, N ads)
**Source of truth:** <build guide, targeting plan, ad copy, creative pack, media plan>

---

## How to Use
<legend and workflow>

---

## Campaign Checklist — Google (one column per campaign)
### Pre-flight (account)
| ID | Check item | Expected / how to verify | <campaign> | ... |
|---|---|---|---|---|
### Structure and type
### Budget, dates, networks
### Keywords and negatives
### Targeting (Display)
### Assets (campaign level)
### Audience layer
### Tracking and QA

---

## Campaign Checklist — Meta (one column per campaign)
| ID | Check item | Expected / how to verify | <campaign> | ... |
|---|---|---|---|---|

---

## Ad Group / Ad Set Checklist (one column per entity)
### Structure
### Keywords / Targeting
### Destination
### Ads in group / set

---

## Ad / Creative Checklist (one column per ad)
### Ad type and setup
### Copy accuracy
### Creative asset
### CTA
### Guardrails
### Policy

---

## Reference
### Campaigns (Google + Meta)
### Ad groups / ad sets
### Negative keywords and exclusions
### Assets
### Creative pack asset list
### Custom segments and assignment
### Ad copy (verbatim)
### Guardrails

---

## Summary
| Level | Entity | Done | In Progress | Not Done | N/A | Completion % |
|---|---|---|---|---|---|---|

---

**Workbook:** <path to .xlsx if generated>
```

---

## EDGE CASES

- **openpyxl unavailable:** Deliver the markdown checklists only and note the workbook can be generated later.
- **Campaign/ad group/ad set set changed:** Regenerate the columns to match the actual entities in the test.
- **User is mid-build and asks how-to questions (e.g. where to set the ad schedule or Meta placements):** Answer with the exact current-UI path from the build guide, and update the checklist item if the UI differs.
- **New UI correction discovered:** Apply it to the workbook and note it in the Reference sheet.
