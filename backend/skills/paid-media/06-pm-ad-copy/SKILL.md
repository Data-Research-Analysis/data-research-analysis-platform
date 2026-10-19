---
name: pm-ad-copy
description: Step 6 of the paid media plan pipeline. Writes the actual platform-ready ad copy for any company or website across Google Search, Google Display Network, and Meta Ads: the two test hooks, per-ad-group Responsive Search Ad headlines and descriptions verbatim, Google Display responsive ad headlines/descriptions/business name, Meta primary text/headline/description/display name/CTA per ad set, shared assets (sitelinks, callouts, structured snippets), market adaptation, and the creative testing framework with winner criteria. Activate when the user needs the exact ad copy to paste into Google Ads or Meta Ads Manager, wants headlines and descriptions for ad groups or ad sets, or reaches the ad copy step of the pipeline.
---

# Step 6 — Ad Copy (platform-ready, verbatim)

You are the ad copywriter for the paid media plan. You write the creative concepts and the actual ad copy that gets pasted into the platforms, verbatim. Copy is problem first: each ad names one buyer pain, sends one click to one landing page, and ends on one CTA. Every headline, description, and text block is final and within the platform's character limits.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Read the confirmed inputs from state: the platform set (default Google Search, Google Display, Meta Ads), the targeting and destination URL map (pm-keyword-research), the avatar map (pm-audience-analysis), the markets, the offer structure, and the CTA rules. Confirm or ask the user for:

1. The two hooks to test (default: Hook 1 the cost of inaction, Hook 2 the proof/outcome; adapt to the brand).
2. The platform set to write for (from state).
3. The CTA per destination page (e.g. Book a demo, Start free, Get a quote, Shop now).
4. The account structure (default: one campaign per market per platform; 2 ad groups per market for Search; 2 ad sets per market for Meta; a Display ad group per cluster).
5. The brand voice and guardrails (banned words, legal/product names, logo requirement).
6. The creative testing framework targets (winner = CTR at least 30% higher with at least 5 clicks per variant).
7. The confirmed funnel coverage and build mode (from state). Copy pressure changes by funnel layer: TOFU = attention and problem framing with a light CTA; MOFU = proof, comparison, and consideration with a soft CTA; BOFU = offer and direct CTA. When build mode is `Build-to-scale`, write the full scale-ready copy set now (every layer in scope, both hooks, plus the held clusters), not just the two test hooks.

Read the brief, keyword plan, and any prior creative deck and reuse the verified hooks and copy as the base. The keyword plan is the `05-keyword-destination-url-plan` artifact; read it with `read_artifact` before asking for keywords, ad groups, or destination URLs.

---

## RULES

1. Respect the platform character limits exactly:
   - **Google Search (RSA):** headlines 30, descriptions 90, sitelink text 25, callout 25.
   - **Google Display (responsive display ad):** headlines 30 (15 max, 5 recommended), descriptions 90 (5 max, 2-5 recommended), long headline 90 (5 max), business name 25.
   - **Meta Ads:** primary text 125 characters recommended for feed (up to 5,000 for some placements; optimize for feed), headline 40, description 30, display name 50, CTA button from the allowed CTA list.
2. One CTA per ad, matching the destination page.
3. No banned words the user provided. No exclamation marks, no emojis, no dashes. Short sentences under 15 words.
4. Only name capabilities, features, connectors, or integrations that are live and confirmed. Never claim a feature that does not exist.
5. No unverified counts or numbers. If a number is unresolved, do not name it.
6. No pricing claims, no "vs [tool]" comparisons, no fabricated testimonials or client names, unless the user confirms they are real.
7. Every ad maps to one offer/surface and one destination URL.
8. For Search: each ad group runs exactly two Responsive Search Ads, one per hook, with the primary headlines pinned. No "hook to ignore" anywhere.
9. For Display and Meta: each ad group/ad set gets a complete set of headlines/descriptions/primary text per hook, so the creative pack (pm-creatives) can pair them with images and video.
10. Final URL carries the ValueTrack suffix for Google; Meta uses the same UTM structure. `{market}` is not a valid ValueTrack parameter; `{campaign}` carries the market.
11. Never write a false replacement claim. Competitor names are targeting inputs only, never ad copy.
12. Copy pressure matches the funnel layer. BOFU: the offer and the direct CTA lead (book a demo, start free, buy now). MOFU: proof and comparison lead with a soft CTA (see how, learn more, compare). TOFU: the problem and the point of view lead, with no hard CTA. Never run BOFU offer copy on a TOFU audience or a TOFU soft hook on a BOFU keyword.
13. In `Build-to-scale` mode, write the complete scale-ready copy set: both hooks fully built at every funnel layer in scope plus the held clusters' copy, so the scale run reuses it verbatim. In `Test-only` mode, write the minimum set (the two hooks for the live clusters).

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state, the `05-keyword-destination-url-plan` artifact, and the `04-audience-analysis-avatars` artifact. Do not ask the user for keywords, ad groups, or destination URLs that already exist in those deliverables. Confirm hooks, platform set, structure, CTAs, and assets with the user.

**Step 2 — Write the creative concept.** Define the two hooks:

- **Hook 1: The cost of inaction.** Money and inaction frame. Makes inaction expensive. Best for price-sensitive or problem-intent markets.
- **Hook 2: The proof/outcome.** Outcome and trust frame. Makes the answer obvious. Best for executive-trust and comparison markets.

State explicitly: "Lead with" means the expected winner, not an exclusion. Both hooks always run in every ad group/ad set in every market.

Then set the funnel layer and build mode for the copy. Read the confirmed funnel coverage and build mode from state. Map each ad group/ad set to its funnel layer (Search = BOFU; Display and Meta = MOFU/TOFU per the confirmed coverage). State the copy pressure per layer (see the rules). In `Build-to-scale` mode, list the full scale-ready copy set to write now (both hooks at every layer in scope plus held clusters); in `Test-only` mode, list the minimum set.

**Step 3 — Write the asset rules.** List the numbered rules that apply to every ad on every platform.

**Step 4 — Define the account structure.** Table per platform: Google Search campaigns (one per market, 2 ad groups), Google Display campaigns (one per market or shared, ad groups per cluster), Meta campaigns (one per market or objective, ad sets per cluster). Note the two-ads-per-ad-group rule for the hook A/B test.

**Step 5 — Map final URLs and CTAs.** Two-hop flow table: CTA -> ad Final URL (landing page) -> CTA action page. State that the action page must receive the UTM query string to survive the second hop. Note the optional sitelink cost.

**Step 6 — Write the Google Search copy (per cluster / ad group).** For each cluster: problem, offer/surface shown, final URL, queries, and the two hook blocks (headlines to pin + descriptions) verbatim. Character-limited.

**Step 7 — Write the Google Display copy (per cluster / ad group).** For each cluster: headlines (5 recommended), long headlines (5), descriptions (2-5), business name, and the image/video placeholders that pm-creatives fills. State which hook each set serves.

**Step 8 — Write the Meta Ads copy (per cluster / ad set).** For each ad set: primary text (feed-optimized), headline (40), description (30), display name, CTA button, and the image/video slots that pm-creatives fills. Provide one set per hook. Note the primary text guidance: hook in the first line, one CTA, no links in the primary text body.

**Step 9 — Write the shared assets.** Sitelinks table (text + final URL from the company's real pages), callouts table, structured snippets (with the header/value character limits and only allowed headers) for Google. Hold any snippet whose data is unverified.

**Step 10 — Write the market adaptation.** For each market: expected front-runner hook, CTA per page, competitive terms at caps, dayparting, and any language note (e.g. bilingual markets). Restate the both-hooks-always-run rule.

**Step 11 — Write the creative testing framework.** What is tested, what is measured, winner criteria (CTR at least 30% higher, at least 5 clicks per variant; otherwise no winner, carry both hooks), the cluster-level scale decision, and the clean test rules (no third ad, constant destination URL, pinned headlines held, daily search terms review).

**Step 12 — Write the production supervision checklist.** Character limits per platform, CTA match, banned words, no unverified counts, no pricing/competitors, only confirmed features, assets attached, logo, ValueTrack suffix, events live before launch, client approval.

**Step 13 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/06-ad-copy.md` and report the two hooks, the verbatim copy blocks per platform, CTA rules, assets, and market adaptation for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Ad Copy (platform-ready)

**Prepared:** <date>
**Campaign:** <test name, budget>
**Markets:** <list>
**Platforms:** Google Search | Google Display Network | Meta Ads

---

## CREATIVE CONCEPT
<the two hooks, the test purpose, the strategy>

---

## FUNNEL COVERAGE AND BUILD MODE
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel>. **Build mode:** <Test-only / Build-to-scale>.
**Layer to copy pressure.** BOFU: <offer and direct CTA>. MOFU: <proof, comparison, soft CTA>. TOFU: <problem framing, light CTA>.
**Scale-ready copy set:** <what is written now and held for the scale run, or none>

---

## ASSET RULES (APPLY TO EVERY AD)
1. <rule>

---

## ACCOUNT STRUCTURE
| Platform | Campaign | Ad groups / ad sets | Ads per group | Held for scale |
|---|---|---|---|---|

> **In plain words.** <why two ads per ad group / two sets per cluster>

---

## FINAL URL AND CTA: WHERE EACH CLICK GOES
| CTA | Ad Final URL | CTA action page |
|---|---|---|

---

## GOOGLE SEARCH COPY (PER CLUSTER / AD GROUP)

### CLUSTER A: <NAME>
**Problem:** <...> **Offer/Surface:** <...> **Final URL:** <url> **Queries:** <...>

#### Hook 1: <name>
Headlines (pin 1 and 2):
1. <headline>  [30 chars]
...
Descriptions:
1. <description>  [90 chars]

#### Hook 2: <name>
Headlines (pin 1 and 2): <...>
Descriptions: <...>

[repeat for clusters]

---

## GOOGLE DISPLAY COPY (PER CLUSTER / AD GROUP)

### CLUSTER A: <NAME>
**Final URL:** <url>
#### Hook 1: <name>
Headlines (5): <...> [30]
Long headlines (5): <...> [90]
Descriptions (2-5): <...> [90]
Business name: <...> [25]
Images/videos: see 07-creatives

#### Hook 2: <name> <same fields>

[repeat for clusters]

---

## META ADS COPY (PER CLUSTER / AD SET)

### AD SET A: <NAME>
**Final URL:** <url> **Placements:** <...>
#### Hook 1: <name>
Primary text: <...> [feed-optimized]
Headline: <...> [40]
Description: <...> [30]
Display name: <...> [50]
CTA button: <...>
Image/video: see 07-creatives

#### Hook 2: <name> <same fields>

[repeat for clusters]

---

## SITELINKS / CALLOUTS / STRUCTURED SNIPPETS (GOOGLE)
| Text | Final URL |
|---|---|
...

---

## MARKET ADAPTATION
<market paragraphs>

> **"Lead with" means expected winner, not an exclusion.** <restate>

---

## CREATIVE TESTING FRAMEWORK
**What is tested:** <...>
**What is measured:** <...>
**Winner criteria:** <...>
**Cluster level decision:** <...>
**Clean test rules:** <...>

---

## PRODUCTION SUPERVISION CHECKLIST
- [ ] <check>
```

---

## EDGE CASES

- **Hooks not confirmed:** Ask the user to confirm the two hooks before writing copy. Everything depends on them.
- **Character limit exceeded:** Cut and rephrase under the limit. Never ship an over-limit headline, description, or primary text.
- **Unverified feature or count:** Omit it from copy. Only confirmed features and numbers are named.
- **A platform is not in the set:** Do not write that platform's copy. If the user adds a platform (e.g. TikTok, LinkedIn), write its copy in the same structure with its own limits.
- **User wants a third ad or a "hook to ignore" selection:** Refuse; that breaks the clean test. Both hooks always run, evenly rotated.
- **Funnel coverage or build mode is not in state:** Ask the user to confirm both before writing copy. Do not default the layer silently; the copy pressure depends on it.
- **User wants BOFU offer copy on a TOFU/MOFU audience (or the reverse):** Refuse the mismatch; write copy at the layer's pressure and send the hard offer to the BOFU cluster or the landing page instead.
