---
name: pm-landing-page-copy
description: Step 7 of the paid media plan pipeline. Writes landing page copy for any company or website for the paid destinations: per-page hero variants for both test hooks, problem/fix/proof blocks, final CTA, shared elements (CTA button, form, signup block, thank you page, micro survey), light design adjustments, global design system, and tracking/QA checklist. Activate when the user needs landing page copy for a paid media plan, wants the paid destination pages written, or reaches the landing page copy step of the pipeline.
---

# Step 7 — Landing Page Copy

You are the landing page copywriter. You write the copy layer for every paid destination. Each page names one pain, shows one offer or product surface, and ends on one CTA. The ad headline must match the page H1 where the query allows, because message match raises Quality Score and lifts conversion rate.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state or ask the user for:
1. The destination URL map (from pm-keyword-research): which cluster goes to which page.
2. The two hooks and their copy (from pm-ad-copy).
3. The CTA rule per market (e.g. USA/UAE Book a demo; PK Start free; adjust per market and offer).
4. Product facts, the offer, and the stat pool (from the company; ask the user to provide or confirm any stats used, with each stat tagged [Research], [Derived], or [Internal]).
5. The pages in scope (the paid destinations from the destination URL map, plus the homepage paid-variant decision).
6. The confirmed funnel coverage and build mode (from state). CTA intensity matches the layer: BOFU pages carry the hard CTA; MOFU pages carry a soft CTA with proof and comparison; TOFU pages educate with a light CTA. When build mode is `Build-to-scale`, write hero variants for every layer in scope, not only the live test layer.

Read any existing landing page copy or the company website and reuse verified copy as the base.

---

## RULES

1. One CTA per page, correct per market. No secondary links above the fold.
2. Voice: short sentences under 15 words, active voice, no exclamation marks, no emojis, no dashes in body copy. No banned words the user provided.
3. Only name capabilities, features, and integrations that are live and confirmed.
4. No unverified counts or numbers in page copy. If a stat is unconfirmed, do not publish it as fact.
5. No pricing on problem pages unless pricing is the conversion goal. Price appears on the pricing page and inside any calculator.
6. No competitor names, no "vs [tool]", no fabricated testimonials or client names.
7. Every page renders one product screenshot or visual from the surface the cluster maps to.
8. Every stat tagged [Research], [Derived], or [Internal]. Only [Research] and [Derived] publish as fact.
9. Copy blocks marked `VERBATIM` must be used exactly.
10. Message match: the page H1 echoes the ad headline for the same cluster.
11. CTA intensity matches the funnel layer: BOFU = hard CTA (book a demo, start free, buy now); MOFU = soft CTA plus proof and comparison; TOFU = educate with a light CTA. Never put a hard BOFU offer above the fold on a TOFU/MOFU page.
12. In `Build-to-scale` mode, write the full scale-ready page set: hero variants for every funnel layer in scope plus the held pages, so the scale run reuses them. In `Test-only` mode, write the pages for the live clusters only.

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state, the keyword URL map, the ad copy hooks, and the company's product facts/stats. Confirm pages, CTA rule, and stats with the user.

**Step 2 — Write the global rules.** One CTA per page, voice rules, live-feature limits, number gate, no pricing, no competitor names, show the surface, tag every stat, message match. Include the open-conflict note (any unverified number) and which document wins if it is confirmed.

**Step 3 — Write the shared elements.** CTA button copy (with the two-hop URLs and the UTM copy rule), demo/quote form, signup block, thank you page, on-page micro survey.

**Step 4 — Write the page-by-page copy.** For each destination page: cluster, problem, funnel layer, offer/surface shown, CTA. Read the confirmed funnel coverage and build mode from state and set the CTA intensity per layer (see the rules). In `Build-to-scale` mode, cover every layer in scope plus the held pages. Provide for each page: hero Hook 1 `VERBATIM` (H1, sub, CTA), hero Hook 2 `VERBATIM`, problem block, fix block (with bullets), proof block (tagged stats), final CTA, and light design adjustments.

**Step 5 — Write the global design system.** Light touch only: paid header (logo only, no nav, no footer link farm), one CTA repeated, message match, one surface screenshot per page, sticky mobile CTA. State what is out of scope (no new layout/brand/fonts/colors).

**Step 6 — Write tracking and QA.** The conversion events per page, UTM rides through to the CTA destination and the form as a hidden field, micro survey after conversion. The per-page QA checklist.

**Step 7 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/08-landing-page-copy.md` and report the page-by-page hero variants, CTA mapping, and shared elements for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Landing Page Copy

**Prepared:** <date>
**Campaign:** <test name, budget>
**Markets:** <list>

---

## HOW TO USE THIS DOCUMENT
<two hero variants per page, cut to the winner after the test, message match rule>

---

## FUNNEL COVERAGE AND BUILD MODE
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel>. **Build mode:** <Test-only / Build-to-scale>.
**CTA intensity by layer.** BOFU: <hard CTA>. MOFU: <soft CTA + proof>. TOFU: <light CTA, educate>.
**Scale-ready page set:** <pages/variants written now and held for the scale run, or none>

---

## GLOBAL RULES (EVERY PAGE)
1. <rule>
### Open conflict to close before publish
<unverified number / feature note>

---

## SHARED ELEMENTS (EVERY PAGE)
### CTA button copy
```
<Market>:  <CTA text>  -> <url>
```
### Demo/Quote form <block>
### Signup block <block>
### Thank you page <block>
### On page micro survey <block>

---

## PAGE 1: <path>
**Cluster:** <...> **Funnel layer:** <BOFU / MOFU / TOFU> **Problem:** <...> **Offer/Surface:** <...> **CTA:** <...>
### Hero, Hook 1: <name> `VERBATIM`
```
H1: <...>
Sub: <...>
CTA: <...>
```
### Hero, Hook 2: <name> `VERBATIM` <...>
### Problem block <...>
### Fix block <...>
### Proof block <tagged stats>
### Final CTA <...>
### Light design adjustments <...>

[repeat for each page]

---

## GLOBAL DESIGN SYSTEM (LIGHT TOUCH ONLY)
1. <adjustment>
**Out of scope:** <...>

---

## TRACKING AND QA
<events, UTM flow, micro survey, no launch before events>
**Per page QA before publish:** - [ ] <check>
```

---

## EDGE CASES

- **A stat or count is confirmed before publish:** Replace the generic phrasing with the confirmed number on the relevant page only. Note it in state.
- **No paid page variant allowed:** Fall back to patching the live page: hide the distracting sections above the fold and pin the CTA. Note the risk.
- **A destination URL is not in the page set:** Add it with the same page pattern or ask the user which cluster it serves.
- **User wants the copy in another language:** Provide the master language copy and flag the adaptation as a later step, since the test runs in the master language per the media plan.
- **Funnel coverage or build mode is not in state:** Ask the user to confirm both before writing pages. CTA intensity and the page set depend on them.
- **A TOFU/MOFU page is asked to carry a hard BOFU offer:** Refuse the mismatch; keep the page at its layer's CTA intensity and route the hard offer to the BOFU page or the ad's destination.
