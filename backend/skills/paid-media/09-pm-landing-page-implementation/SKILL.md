---
name: pm-landing-page-implementation
description: Step 8 of the paid media plan pipeline. Turns landing page copy into a build-ready implementation plan for any company or website: the deliverable map (page to file target), dependency gates, implementation sequence by phase, the shared page pattern, non-negotiable copy rules, acceptance checklist, ownership, timeline, and risks. Activate when the user needs the landing page implementation plan for a paid media plan, wants to know how to ship the paid pages, or reaches the implementation step of the pipeline.
---

# Step 8 — Landing Page Implementation Plan

You are the implementation planner. You turn the landing page copy deck into a plan a developer (human or AI) can execute to ship the paid destinations. Every page mirrors the winning ad hook, shows one offer or product surface, and forces one CTA.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state or ask the user for:
1. The landing page copy deck (from pm-landing-page-copy).
2. The tech stack and file structure (ask the user which framework and where pages live, e.g. Nuxt 3 `frontend/pages/`, Next.js `app/`, WordPress, Webflow, etc.).
3. The destination URLs and their status (from pm-keyword-research; must be confirmed live).
4. The CTA rule per market.
5. Whether a paid page variant is allowed or the live pages must be patched.
6. Open gates that block publish (winning hook confirmed, unverified numbers resolved, brand assets supplied, tracking events live).

Read any prior implementation plan or the existing site structure and reuse its structure and gates as the base.

---

## RULES

1. Never start production on a page while its gates are open. List the gates and their owners first.
2. The page pattern is identical across all paid destinations: paid header, hero with H1+sub+CTA, problem block, fix block with surface visual, proof block, final CTA, sticky mobile CTA, minimal footer.
3. Copy rules are non-negotiable and come from the copy deck: one CTA per page, correct CTA per market, no banned words, no unverified numbers, no pricing on problem pages, no competitor names, only confirmed features, tagged stats, legal and product names correct, logo present.
4. The CTA is a two-hop flow. The button must copy the UTM query string from the landing page URL so campaign context survives to the action page.
5. Every acceptance item must be verifiable, not assumed.

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state and the copy deck. Confirm stack, URLs, CTA rule, and the paid-variant decision with the user.

**Step 2 — Build the deliverable map.** Table: page | file target | cluster | offer/surface | primary CTA.

**Step 3 — Build the dependencies and gates table.** Gate | status | owner | note. Include: winning hook confirmed, unverified numbers resolved, conversion events live, brand assets supplied, destination URLs live, CTA rule resolved.

**Step 4 — Write the implementation sequence by phase.**

- Phase 0 Confirm (day 0): confirm hooks, close unverified numbers, align CTAs, confirm the paid-variant decision.
- Phase 1 Copy into pages (days 1-2): apply VERBATIM blocks, keep shared elements identical, set CTA per market and wire destinations.
- Phase 2 Light design (days 2-3): paid header, one surface visual per page, sticky mobile CTA, confirm ad headline = page H1.
- Phase 3 Tracking (days 3-4): wire the conversion events, copy UTM query string onto the CTA href and the form as a hidden field, wire the micro survey, test each event in debug view.
- Phase 4 QA and publish (day 4): per-page QA checklist, client sign off, publish behind campaign URLs, reconfirm final URLs with ValueTrack suffix under the character limit.

**Step 5 — Write the page pattern.** The 8-section pattern block.

**Step 6 — Write the copy rules and acceptance checklist.** Non-negotiable rules; verifiable acceptance items.

**Step 7 — Write ownership and timeline.** Workstream ownership table and a milestone table with new dates (set a clean test window).

**Step 8 — Write the risks.** Schedule slip, page leak, unverified-number conflict, CTA rule conflict, tracking dependency (the single largest risk).

**Step 9 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/09-landing-page-implementation.md` and report the deliverable map, gates, and timeline for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Landing Page Implementation Plan

**Prepared:** <date>
**Scope:** Landing page copy and light design adjustments for the paid destinations.
**Copy source:** <copy deck file>

---

## OBJECTIVE
<one paragraph>

---

## DELIVERABLE MAP
| Page | File target | Cluster | Offer/Surface | Primary CTA |
|---|---|---|---|---|

---

## DEPENDENCIES AND GATES
| Gate | Status | Owner | Note |
|---|---|---|---|

---

## IMPLEMENTATION SEQUENCE
### Phase 0: Confirm (day 0) <numbered items>
### Phase 1: Copy into pages (days 1 to 2) <numbered items>
### Phase 2: Light design (days 2 to 3) <numbered items>
### Phase 3: Tracking (days 3 to 4) <numbered items>
### Phase 4: QA and publish (day 4) <numbered items>

---

## PAGE PATTERN (APPLY TO ALL PAID PAGES)
```
1. Paid header (logo only)
2. Hero: H1, Sub, one CTA
3. Problem block (question header)
4. Fix block + surface visual
5. Proof block (tagged stats)
6. Final CTA (same button text)
7. Sticky mobile CTA
8. Paid footer (minimal, legal only)
```

---

## COPY RULES (NON NEGOTIABLE)
1. <rule>

---

## ACCEPTANCE CHECKLIST
- [ ] <item>

---

## OWNERSHIP
| Workstream | Owner | Support |
|---|---|---|

---

## TIMELINE
| Milestone | Proposed date | Note |
|---|---|---|

---

## RISKS
1. <risk>
```

---

## EDGE CASES

- **Gates open:** Do not propose production on a blocked page. List what must close first.
- **No paid variant allowed:** Patch the live pages (hide distracting sections above the fold, pin the CTA) and note the leak risk.
- **Different stack:** Replace the file targets with the actual framework's page structure and state the change.
- **Schedule slip:** Reset the timeline to a clean test window and confirm the new dates with the user.
