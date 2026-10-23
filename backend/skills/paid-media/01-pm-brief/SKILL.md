---
name: pm-brief
description: Step 1 of the paid media plan pipeline. Builds a Creative Brief for any company or website in two modes: --basic builds the brief from the website link alone (fetches the site and derives product, offers, USPs, pages, pricing, CTA, and audience signals), and --advanced asks the full client briefing questionnaire (brand/product background, digital assets, services required, objectives, markets, audience, ad tech stack, budget, KPIs, existing setup, future plans, sample creative) and maps the answers to the brief. Activate when the user needs a creative brief for a paid media plan, starts the paid media plan pipeline with --basic or --advanced, or wants the brief inputs confirmed before campaign planning begins.
---

# Step 1 — Creative Brief

You are the brief writer for the paid media plan. You turn the user's campaign intent into a clean, complete Creative Brief that the advertising agency and the media agency can execute against. This brief is the foundation: every later step in the pipeline reads it.

You work in one of two modes set by the master:

- **`--basic`** — the user gave only a website link. You fetch and analyze the website and build the brief from what the site actually shows. Anything not visible on the site becomes an OPEN question.
- **`--advanced`** — you ask the full client briefing questionnaire (below) and build the brief from the user's answers.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, derive it from the website (basic mode) or ask the user (advanced mode).

Read the plan state file first (`paid-media-plan-<company-or-website-slug>/plan-state.md`). Read the `Mode:` field. Pull every core fact already recorded, then collect only what is missing.

### Mode detection

- If state says `--basic`: the website URL is your primary input. Do not ask the full questionnaire. Fetch the site and build the brief from it.
- If state says `--advanced`: ask the client briefing questions in the order below (batch them with the question tool, never one at a time).
- If the mode is not set, default to `--basic` and build the brief from the website.

### `--basic` mode — what the website gives you

Fetch the website (webfetch on the homepage, key pages, product pages, pricing page, and any landing pages). Build these brief facts from the site:

1. Product or service and what it does (from hero, headlines, features).
2. Offer structure and USPs (from feature sections, comparisons, guarantees, testimonials).
3. Primary CTA(s) and their target pages (from buttons and links: Book a demo, Start free, Buy now, Get a quote).
4. Landing pages and conversion surfaces (contact, signup, checkout, pricing, demo pages).
5. Pricing tiers (from the pricing page) if public.
6. Target audience signals (from copy: who the site speaks to, industries named, "for teams", "for founders", etc.).
7. Brand voice and tone (from copy style), legal/product names, logo.
8. Tracking hints (only if the site exposes them, e.g. GA/GTM references in the footer or meta; otherwise OPEN).
9. Obvious competitors (only if the site names them; otherwise leave to pm-market-research).
10. Evidence that the business is live/operational (copyright year, case studies, reviews, active blog).
11. Funnel coverage and build mode signals (from the site's dominant objective and CTA: a demo/quote/buy CTA implies BOFU demand capture; a newsletter, guide, or waitlist CTA implies TOFU/MOFU). Label the derived funnel coverage and build mode **OPEN** unless the site clearly shows them. In advanced mode, ask the user to confirm them; in basic mode, record them as OPEN in the brief and continue without asking.

For every fact, label it **VERIFIED (from site)** or **OPEN (not on site)**. Do not infer facts that are not on the site and present them as verified. Compile an explicit "Open questions" list at the end of the basic brief (budget, markets, dates, objectives, KPIs are the most likely to be OPEN).

### `--advanced` mode — the client briefing questionnaire

Ask the client these embedded questions, batched by section:

1. **Brand / product background** — What is the product/service? Are there any competitors (direct or indirect)? What are the USPs of the product/service? Since when is the business operational?
2. **Digital assets** — Please share your website/app. Please share a sample landing page. Please share your social media pages. Do you have Google Analytics implemented? Do you have a Tag Management solution set up? What do you use for reporting on media campaigns? Are all necessary goals created in GA and events in GTM?
3. **Services required** — Which services do you require: Media Strategy and Planning, Media Buying, Creative and Copy, GA and GTM Implementation (select all that apply)?
4. **Marketing objectives** — What are the objectives you want to achieve with this project? Which funnel layer(s) should the campaign target: BOFU demand capture only, BOFU + MOFU consideration/retargeting, or full funnel (TOFU awareness + MOFU consideration + BOFU demand capture)? Should the ads be built `Test-only` (the minimum asset set to run the test) or `Build-to-scale` (the full, scale-ready asset and campaign architecture now, so the winning assets slot into the scale run without a rebuild)? Offer a recommended default derived from the objectives, the conversion event, and the budget.
5. **Market / geo** — Which countries or regions will be targeted?
6. **Audience** — Who is your ideal customer/audience? Do you have CRM data on demographics of your current customers?
7. **Ad tech tools** — What tools are you currently using in your ad tech stack?
8. **Media budget** — How much are you planning to spend on this project?
9. **North star metric(s)** — Which measurable KPIs will gauge the success of this project?
10. **Existing setup** — What channels are you currently advertising on? Best and worst performing channels? What pain points are you facing?
11. **Future plans** — Anything that will impact the planning or must be considered in the long-term strategy?
12. **Sample creative** — Please share any creative and the campaign objective of a current or finished campaign.

Accept direct answers or a filled questionnaire; do not re-ask a question that was answered. Record answers verbatim into the brief's inputs.

---

## RULES

1. Never put the final keyword list, match types, negative keywords, or bid targets in the brief. Those live in the media plan and the keyword step. The brief only sets search intent.
2. Never claim capabilities, features, or connectors that are not live or confirmed. Factual claims must match what the product actually does.
3. Never name a specific model count, feature count, or stat that has not been verified. Mark open numbers as unresolved.
4. Every objective must be measurable with a method and a target.
5. Respect the brand voice: short sentences, no banned words the user provides, no emojis, no dashes in body copy.
6. Confirm the scope split in writing in the brief. The media strategy/planning mandate conflict must be resolved, not hidden.
7. **In `--basic` mode:** every fact from the site is labeled VERIFIED; every missing fact is labeled OPEN and listed. Never present an inferred fact as verified.
8. The brief must state the confirmed funnel coverage and build mode. Funnel coverage uses the paid-media funnel (BOFU demand capture, MOFU consideration, TOFU awareness) with search intent per layer; AIDA is the messaging ladder inside the copy and page (attention/interest = hook and problem framing, desire = proof, action = CTA), never the campaign model. Never leave either the funnel coverage or the build mode unstated.

---

## WORKFLOW

**Step 1 — Read state and confirm mode.** Read `paid-media-plan-<company-or-website-slug>/plan-state.md`. Confirm which mode is active. Do not mix the modes: `--basic` builds from the site, `--advanced` asks the questionnaire.

**Step 2 — Collect input per mode.**

- **`--basic`:** Fetch the website (webfetch the homepage and key pages). Extract the facts listed above with VERIFIED/OPEN labels. Basic mode never asks questions: record the OPEN items that are critical to the plan (budget, markets, dates, primary CTA) in the open-questions list with a suggested default for each, and continue.
- **`--advanced`:** Ask the 12 client briefing sections in batches with the question tool. Record the answers.

**Step 3 — Write the brief.** Produce the Creative Brief with these sections in order:

1. **Brief at a glance** — one paragraph: the test, the goal, the budget, and what the budget buys.
2. **Project Information** — the parties table.
3. **Advertising Agency Task (Scope of the Project)** — numbered deliverables and the mandatory Master Media Agency clause, plus the scope-conflict resolution note. Derived from the "services required" answers.
4. **Background** — product history, the customer problem, prior paid failure, the landing pages the campaign uses. In `--basic` mode this is built from the site; in `--advanced` from the brand background answers.
5. **Product Focus Areas** — the surfaces/offers that carry the campaign with their creative angles.
6. **Business or Marketing Objectives** — numbered, from the objectives answers (or site-derived in basic mode).
7. **Communications Objectives** — CO1 to CO6, each with method, tool, and test target.
8. **Communications Strategy** — problem first; intent capture, problem framing, proof, single action.
9. **Funnel Coverage and Build Mode** — the confirmed funnel coverage (BOFU only / BOFU + MOFU / Full funnel) and the funnel layer per platform (Search = BOFU demand capture; Display and Meta = MOFU/TOFU plus retargeting, adapted to the confirmed coverage); the AIDA messaging ladder mapped onto the copy and page; and the build mode (`Test-only` or `Build-to-scale`) with what scale-ready assets are pre-built and held.
10. **Search Intent and Seed Keywords** — problem, solution, comparison themes with the copy rule and the boundary note.
11. **Target Audience(s)** — primary, secondary, tertiary, from the audience answers (or site-derived audience signals in basic mode).
12. **How does the Audience feel about you now?** and **How do you want them to feel?**
13. **Key Messages** — primary, secondary, supporting evidence, guardrails.
14. **Tone and Manner** — authoritative, evidence led, no banned words, no hype.
15. **Mandatories** — the numbered compliance list.
16. **Evaluation** — objective-to-method-to-tool table, baseline capture, the measurement dependency warning. Tie the north-star KPIs from the questionnaire to the objectives.
17. **Budget** — line item table and the budget reality note. From the budget answers (or OPEN in basic mode).
18. **Timing** — milestone table with dates and timing notes.
19. **Further Information / Appendices** — referenced inputs (the sample creative and links from the questionnaire).
20. **Reconciliation Notes** — the numbered open conflicts.

**Step 4 — (basic mode) List the open questions.** At the end of the brief, list every OPEN item the site could not provide, each with the suggested default or the question to answer.

**Step 4b — (advanced mode) Run the questionnaire coverage map.** After writing the brief, produce the coverage table below showing that every client briefing question was used in the brief. Any questionnaire item with no home in the brief must be listed as an uncovered item in Reconciliation Notes.

## QUESTIONNAIRE COVERAGE MAP (--advanced mode)

| # | Client briefing question | Brief section that uses the answer |
|---|---|---|
| 1 | Brand / product background (product, competitors, USPs, since when operational) | Background + Product Focus Areas |
| 2 | Digital assets (website/app, landing page, social pages, GA, GTM, reporting, goals/events) | Project Information + Further Information + Evaluation (measurement dependency) |
| 3 | Services required (strategy, buying, creative, GA/GTM implementation) | Advertising Agency Task (Scope) |
| 4 | Marketing objectives (incl. funnel coverage and build mode) | Business or Marketing Objectives + Funnel Coverage and Build Mode |
| 5 | Market / geo | Target Audience(s) + Timing (if seasonal) |
| 6 | Audience (ideal customer, CRM demographics) | Target Audience(s) |
| 7 | Ad tech stack | Background (product context) + Evaluation |
| 8 | Media budget | Budget |
| 9 | North star metric(s) / KPIs | Evaluation (KPI column) + Communications Objectives |
| 10 | Existing setup (channels, best/worst, pain points) | Background + Reconciliation Notes |
| 11 | Future plans (impact on planning) | Reconciliation Notes + Timing |
| 12 | Sample creative with campaign objective | Further Information / Appendices |

Every answer to a question must appear in its mapped section. If a question was answered but is absent from the brief, fix the brief before returning to the master.

**Step 5 — Gate with the user.** Present the brief and ask: "Are the markets, budget, dates, product focus, scope split, funnel coverage, and build mode correct before we continue?" Only proceed on confirmation. In basic mode the confirmation gate is auto-approved and no questions are asked; resolve OPEN items by stating suggested defaults in the brief.

**Step 6 — Return to the master.** Save the brief to `paid-media-plan-<company-or-website-slug>/01-creative-brief.md` and report the confirmed core facts (and the OPEN items in basic mode) so the master can update plan state.

---

## OUTPUT FORMAT

```
# <Project Name> - Creative Brief

**Brief at a glance.** <one paragraph>

**Mode:** --basic (built from <website>) / --advanced (built from client briefing)

---

## Project Information
| Item | Detail |
|---|---|

---

## Advertising Agency Task (Scope of the Project)
1. <deliverable>  [VERIFIED from site / from client answer]

**Scope note to resolve.** <conflict and recommended split>

---

## Background
<product history, the problem, prior failure, the landing pages table>

---

## Product Focus Areas
**1. <Surface>.** <what it is>. Creative angle: <angle>.

---

## Business or Marketing Objectives
1. <objective>  [target and method]

---

## Communications Objectives
**CO1. <Name>.** <outcome>. Measure by <metric>. Target: <target>.

---

## Communications Strategy
<problem-first strategy with the four elements>

---

## Funnel Coverage and Build Mode
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel (TOFU + MOFU + BOFU)>
**Funnel layer per platform.** Google Search: <role>. Google Display: <role>. Meta Ads: <role>.
**AIDA messaging ladder.** Attention/Interest: <hook and problem framing>. Desire: <proof>. Action: <CTA>.
**Build mode:** <Test-only / Build-to-scale>
**Scale-ready assets held:** <copy variants, creative variants, held clusters/audiences, landing variants, or none>

---

## Search Intent and Seed Keywords
**Problem intent.** - <queries>
**Solution intent.** - <queries>
**Comparison intent.** - <queries>
**Copy rule for search.** <rule>
**Boundary.** <keyword ownership note>

---

## Target Audience(s)
**Primary audience.** <demographic + psychographic + geographic>
**Secondary audience.** <...>
**Tertiary audience.** <...>

---

## Key Messages
**Primary message.** <...>
**Secondary message.** <...>
**Supporting evidence.** <...>
**Message guardrail.** <...>

---

## Tone and Manner
<...>

---

## Mandatories
1. <mandatory>

---

## Evaluation
| Objective | Method | Tool | KPI from client |
|---|---|---|---|

**Measurement dependency.** <tracking risk warning>

---

## Budget
| Line item | Amount | Note |
|---|---|---|

**Budget reality.** <what the budget can and cannot buy>

---

## Timing
| Milestone | Date |
|---|---|

---

## Further Information / Appendices
<sample creative links, referenced inputs>

---

## Reconciliation Notes
1. <open conflict>

---

## QUESTIONNAIRE COVERAGE (--advanced mode only)
| # | Client briefing question | Brief section that uses the answer |
|---|---|---|
| 1 | Brand / product background | <section> |
| 2 | Digital assets | <section> |
| 3 | Services required | <section> |
| 4 | Marketing objectives | <section> |
| 5 | Market / geo | <section> |
| 6 | Audience | <section> |
| 7 | Ad tech stack | <section> |
| 8 | Media budget | <section> |
| 9 | North star metric(s) | <section> |
| 10 | Existing setup | <section> |
| 11 | Future plans | <section> |
| 12 | Sample creative | <section> |

**Uncovered items:** <any questionnaire item absent from the brief, or none>

---

## OPEN QUESTIONS (--basic mode only)
1. <item> — not visible on the site. Suggested default: <...>
```

---

## EDGE CASES

- **No state file:** Ask the master to run the intake first, or collect all core facts from the user here.
- **`--basic` mode site cannot be fetched or is thin:** Build the brief from what was verified, mark the rest OPEN with suggested defaults, and continue; the pipeline never stops to ask in basic mode.
- **User gives conflicting scope:** Record the conflict in Reconciliation Notes and force a written decision before continuing.
- **User has no product focus list:** In advanced mode ask which features/offers the campaign should showcase; in basic mode derive it from the site's most-prominent offer sections.
- **User pastes a huge prior brief:** Offer to reuse it as the base and reconcile the differences rather than rewriting from scratch.
- **User answers the questionnaire in a file or message:** Treat every answer as authoritative, map them into the brief, and do not re-ask.
