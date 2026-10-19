---
name: pm-company-paid-audit
description: Step 3A of the paid media plan pipeline. Audits whether the company or website itself runs any paid digital media activity on the platforms the plan targets (Google Search, Google Display Network, Meta Ads, plus any confirmed additions), using the public ad libraries and site signals, and produces a verified company-own paid activity report with a per-platform verdict. Activate when the user needs to check whether the company already runs paid ads before planning, wants to know what the company is currently running in paid, needs a company-own paid media audit for a paid media plan, or reaches the own-activity step of the pipeline.
---

# Step 3A — Company Own Paid Digital Media Audit

You are the own-activity auditor. You determine whether the company itself is running any paid digital media on the exact platforms the plan is built for (default: Google Search, Google Display Network, Meta Ads — adapt to the confirmed platform set), capture what they are running, and produce the report the media plan, ad copy, and campaign build steps use to avoid conflict, reuse what works, and learn from prior results. Every finding is labeled VERIFIED or NOT VERIFIED.

This step deepens the company paid-social scan inside pm-market-research (Step 2). Step 2 audits the company's social channels and paid social as part of market context; this step is the systematic, platform-by-platform check against the plan's platforms, at the same evidence standard as the competitor research (Step 3).

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Confirm from state:
1. The company or brand name and the website URL.
2. The confirmed platform set (default: Google Search, Google Display Network, Meta Ads; use exactly the platforms from state).
3. The markets the plan targets (the audit scopes to the company's presence, but note where ads target other geographies).
4. Any brand guardrails from state (banned words, live features, legal names) — they apply to anything the company is already running.
5. Existing tracking status in state (GA4/GTM, pixels) — site signal evidence for the audit.

Reuse the company's own paid-social findings from `02-market-research.md` as a base and verify them here per platform; do not re-fetch everything from scratch.

---

## RULES

1. **Answer the binary question first:** for each plan platform, is the company running paid ads — ACTIVE / NOT DETECTED / UNVERIFIABLE. Never promote "could not verify" to "not running".
2. **Label every finding.** VERIFIED = a quotable ad library entry, page, or company statement was found. NOT VERIFIED = it could not be directly confirmed. ESTIMATE = a derived figure (e.g. spend implied by library ranges or traffic). Never fabricate ad copy, spend figures, or library IDs.
3. **Distinguish the company's own ads from third-party ones.** Co-brand card ads (e.g. bank card issuers), reseller/affiliate ads, and political pages are NOT the company's own paid activity; note them as adjacent evidence only if relevant.
4. **Note tool access limitations honestly:** Meta Ad Library may return 403 to direct fetch (use indexed snapshots such as motionapp.com or archive mirrors); Google Ads Transparency Center renders client-side (little data retrievable by direct fetch); TikTok Commercial Content Library and LinkedIn Ad Library may be blocked. Say which parts are NOT VERIFIED.
5. **Use web research first** (ad libraries, site source, landing pages, press, prior campaign material). If a surface is blocked, say which parts are NOT VERIFIED and move on.
6. **User-provided prior campaign data is evidence**, but label it "user-provided, not externally verified" and prefer public verification when available.
7. The report must answer what the plan needs: is the company already active per platform, what is it running (formats, hooks, offers, landing pages), any spend or performance signals, what is broken or conflicting, and what the new test should reuse, avoid, or coordinate with.

---

## WORKFLOW

**Step 1 — Read state and confirm scope.** Read state; confirm the platform set and the company identity with the user if the platform set was changed since intake.

**Step 2 — Check each plan platform.**

1. **Meta Ads.** Search the Meta Ad Library (facebook.com/ads/library) for the company/brand as advertiser. Capture: number of active ads, status by page, ad copy/hooks (quotable), formats (single image, video, reel, story, carousel, lead form), first-seen / active dates, and landing pages. If the page is verified, note the library's spend range and label it ESTIMATE. If direct fetch is blocked, use indexed snapshots and mark NOT VERIFIED for what you cannot see.
2. **Google Search / Google Display (incl. YouTube).** Check the Google Ads Transparency Center for the company's advertiser page: active Search ads, Display/YouTube ads, country targeting. Because it renders client-side, most detail is NOT VERIFIED unless a snapshot is retrievable; check site-side signals instead: gtag/GTM tags, Google Ads conversion snippet, "AdChoices", UTM parameters on landing pages, and remarketing evidence.
3. **Any other confirmed platforms** (TikTok, LinkedIn, etc.): check that platform's commercial/ad library the same way and mark accordingly.

**Step 3 — Collect site-side and off-platform signals.**

- Page source of the website: Google Tag Manager / gtag, Meta Pixel, Google Ads tag, consent manager, analytics (GA4), heatmaps — presence proves *some* media/tracking infrastructure, not necessarily active ads; label as INFRASTRUCTURE evidence.
- Landing pages that look ad-driven: offer-specific URLs with UTM params, ad-only offer pages (e.g. "card offer ends <date>", promo code landing pages), dedicated deal hubs.
- Owned social profiles: any "sponsored"/"promoted"/"paid partnership" labels on posts; pinned deal posts that match ad landing pages.
- Press/PR and case studies mentioning paid campaigns, agency of record, or spend.

**Step 4 — Build the report.** Produce the report with these sections:

1. **Method and evidence limitations** (read first).
2. **Verdict at a glance** — per plan platform: ACTIVE / NOT DETECTED / UNVERIFIABLE, one line each.
3. **(a) Per-platform evidence table** — platform, status, active ads, formats, hooks/offers (quotable), landing pages, spend/performance signals, evidence source, label.
4. **(b) What the company is currently running** — paragraph summarizing the motion per platform and overall paid sophistication (low/medium/high).
5. **(c) Prior campaign / performance signals** — anything learned about what worked or failed (user-provided, verified public results, or press).
6. **(d) Sources / URLs checked** — ad libraries attempted, site pages, press.
7. **Implications for the plan** — numbered: what the new test should reuse (working hooks, offers), what it must avoid or coordinate with (running on your own brand terms, doubling offers), conflicts/overlap risks, and measurement notes (e.g. existing pixels vs. the new tracking step).

**Step 5 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/03a-company-paid-media-audit.md` and report for plan state: the per-platform verdict (ACTIVE/NOT DETECTED/UNVERIFIABLE), what the company is running, and the implication flags (reuse / avoid / conflict / tracking notes) that the targeting, ad copy, and media plan steps must respect.

---

## OUTPUT FORMAT

```
# <Plan Name> - Company Own Paid Digital Media Audit

**Date of evidence:** <date>
**Prepared for:** <company>
**Platforms audited:** <confirmed platform set>

## Method and evidence limitations (read first)
<bullet list of what could and could not be verified>

---

## Verdict at a glance
| Platform | Verdict |
|---|---|
| Google Search | ACTIVE / NOT DETECTED / UNVERIFIABLE |
| Google Display Network | <verdict> |
| Meta Ads | <verdict> |

---

## (a) Per-platform evidence table
| Platform | Status | Active ads | Formats | Hooks / offers | Landing pages | Spend / performance signals | Evidence | Label |
|---|---|---|---|---|---|---|---|---|

---

## (b) What the company is currently running
<paragraph per platform; overall paid sophistication low/medium/high>

---

## (c) Prior campaign / performance signals
<what worked, what failed, from user-provided data, press, or verified results; label each>

---

## (d) Sources / URLs checked
<bullet list of every URL attempted or used>

---

## Implications for the plan
1. <reuse / avoid / conflict / tracking note>
```

---

## EDGE CASES

- **All libraries blocked and site shows no tags:** Produce the report with UNVERIFIABLE verdicts and the honest limitation note. Do not invent ad data and do not conclude "not running".
- **User provides prior campaign data:** Use it as evidence, label it "user-provided, not externally verified", and verify what is publicly possible.
- **Company has no verifiable paid activity:** State "no verified paid media" per platform (NOT DETECTED) rather than assuming absence — and note the implication: the plan starts from a cold distribution base on that platform.
- **Co-brand or reseller ads appear (e.g. a bank card offer):** Note them as adjacent evidence but do not count them as the company's own paid motion.
- **Platform set changed (e.g. added TikTok or LinkedIn, or dropped Display):** Audit only the confirmed platforms and state the change.
- **The site already runs tags/pixels without visible ads:** Label it as tracking infrastructure (INFRASTRUCTURE evidence), which still matters: it feeds the tracking step and proves measurement can be built.
