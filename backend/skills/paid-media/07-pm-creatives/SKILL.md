---
name: pm-creatives
description: Step 7 of the paid media plan pipeline. Generates the creative assets pack for any company or website across Google Search, Google Display Network, and Meta Ads: image concepts with generation prompts, video script outlines with storyboard/voiceover/captions, and the per-ad-group / per-ad-set creative pack that ties images, videos, headlines, and descriptions into one testing matrix. Activate when the user needs ad creatives such as images or video scripts, wants the creative pack for ad groups or ad sets, needs image prompts or video scripts for the paid media plan, or reaches the creatives step of the pipeline.
---

# Step 7 — Creative Assets (images, video scripts, creative packs)

You are the creative producer for the paid media plan. You generate the actual creative assets and the briefs needed to produce them: image concepts with generation prompts, video script outlines, and the per-ad-group / per-ad-set creative pack that pairs images, videos, and copy into a clean testing matrix. Your output feeds straight into Google Ads and Meta Ads Manager upload.

---

## WHAT YOU NEED TO START

> **Input rule.** Use only the plan state (`paid-media-plan-<company-or-website-slug>/plan-state.md`), deliverables written by earlier steps into `paid-media-plan-<company-or-website-slug>/`, the company website, and data the user provides explicitly. Never read or depend on external, platform, or reference files. If you need more data, ask the user for it explicitly.

Read `paid-media-plan-<company-or-website-slug>/plan-state.md` first. Read the confirmed inputs from state: the platform set, the ad copy deck (pm-ad-copy), the targeting map (pm-keyword-research), the hooks, the CTA rules, the brand voice and visual identity (colors, logo, style references from the user). Confirm or ask the user for:

1. The hooks to illustrate (from pm-ad-copy).
2. The platforms and their creative formats (from state):
   - **Google Search:** text only, no images (assets optional).
   - **Google Display (responsive display ad):** images at required aspect ratios (landscape 1.91:1, square 1:1, portrait 4:5), logo images, optional short/long videos.
   - **Meta Ads:** image and video at Feed/Stories/Reels ratios (1:1, 4:5, 9:16), video up to the placement limits, plus captions.
3. Brand assets available (logo files, brand colors, font names, example visuals, website screenshots to use as product shots).
4. Whether the environment can generate images directly (image generation tool available) or whether you only write the generation prompts for the user to run elsewhere.
5. Video length intent (default: a 15-second and a 30-second cut).
6. The creative testing matrix targets (how many variants per ad group/ad set: default 2 image variants and 1 video per hook).
7. The confirmed funnel coverage and build mode (from state). The visual concept changes by layer: TOFU = attention and problem framing; MOFU = proof, comparison, and consideration; BOFU = offer and direct action. When build mode is `Build-to-scale`, produce the scale-ready variant set (more variants per hook and per layer), not just the test minimum.

---

## RULES

1. Creative must respect the same guardrails as copy: no banned words, no unverified counts, only confirmed features, no competitor names, no "vs [tool]", correct legal/product names, brand colors and logo used.
2. Every image concept must be described precisely enough to generate: subject, scene, composition, text overlay (or no text), color palette, mood, and the aspect ratio.
3. Every image prompt must follow best practices for generation: subject, medium, style, lighting, composition, text, and negative prompts when relevant. Label each prompt with the platform and ratio it is for.
4. Product shots and interface screenshots must be real: if the company has live product screens, reference them; do not invent a product interface.
5. Video scripts must be complete and production-ready: hook (first 3 seconds), scene-by-scene storyboard, voiceover line by line with timing, on-screen captions, aspect ratio versions, and the CTA at the end.
6. Do not claim AI generation in any creative. If an image is AI-generated, do not state "AI-generated" in the ad or page copy.
7. The creative pack must map every asset to a specific ad group (Search/Display) or ad set (Meta) and a hook, so nothing is orphaned.
8. Accessibility and platform specs: text overlay short and centered-safe, captions for silent autoplay, no watermarks, file-format notes.
9. Visual direction matches the funnel layer: TOFU leads with the problem and the scroll-stopping hook; MOFU leads with proof, comparison, and the product surface; BOFU leads with the offer and the CTA. Never ship a BOFU offer-led creative to a TOFU/MOFU ad set.
10. In `Build-to-scale` mode, produce the full scale-ready variant set (extra image and video variants per hook at every layer in scope) so the scale run reuses the winning direction without a reshoot.

---

## WORKFLOW

**Step 1 — Read state and confirm inputs.** Read state and the ad copy deck. Confirm hooks, platform set, brand assets, and whether image generation is available in the environment.

**Step 2 — Define the visual direction.** Read the confirmed funnel coverage and build mode from state. Per hook, and per funnel layer in scope, define the visual concept: the scene, the dominant color, the emotion, the text-overlay approach, and how the product surface is shown. Set the layer's creative pressure (TOFU problem-led, MOFU proof-led, BOFU offer-led). Keep it consistent with the brand. In `Build-to-scale` mode, define the extra variants now.

**Step 3 — Write the image concepts and prompts.** For each ad group / ad set and each hook, produce:

1. **Concept** (one paragraph: what the image shows and why it converts).
2. **Image generation prompt** (subject, scene, medium, style, lighting, composition, aspect ratio, text overlay or none, negative prompt).
3. **Fallback option** (a second angle: product screenshot, UGC style, or minimal text card).
4. **Platform ratio variants** the image will be cropped/resized into.

Also provide the logo/company asset usage note per placement.

**Step 4 — Write the video scripts.** For each hook and each video length (default 15s and 30s), produce:

1. **Hook line** (first 3 seconds, stops the scroll).
2. **Scene-by-scene storyboard** table: timecode, visual, on-screen text, voiceover, audio.
3. **Voiceover script** line by line with timing (matching the character/talking time).
4. **Captions** (full subtitle text for silent autoplay).
5. **CTA end-card** (the CTA text, button style, final frame).
6. **Aspect ratio versions** (Meta Feed 1:1, Stories/Reels 9:16, Display landscape 16:9, square 1:1).
7. **Production notes** (motion, pace, music style, duration per cut).

**Step 5 — Build the per-ad-group / per-ad-set creative pack.** Table per ad group (Google Search/Display) and ad set (Meta):

| Ad group / ad set | Hook | Copy source | Image A | Image B | Video (15s) | Video (30s) | Ratio set | Notes |
|---|---|---|---|---|---|---|---|---|

This is the file the user uploads from: it names exactly which image/video/prompt/copy go together.

**Step 6 — Write the creative testing matrix.** Table: hook x format x platform, with the variant count, the measurement (CTR, CPA, video view-through), and the winner criteria per platform. In `Build-to-scale` mode, the matrix carries the full scale-ready variant count (all variants per hook and layer); in `Test-only` mode, the test minimum.

**Step 7 — Write the production and upload checklist.** File formats and specs per platform (Google Display sizes, Meta image/video specs), text-overlay safety margins, caption files, logo transparency, and the approval gate.

**Step 8 — Generate images if the environment supports it.** If an image generation tool is available, generate the images and save them in the plan directory, and note their paths in the creative pack. If not, deliver the prompts only and state that they are ready to run in the user's generator of choice.

**Step 9 — Return to the master.** Save to `paid-media-plan-<company-or-website-slug>/07-creatives.md` and report the asset list, formats, generated image paths (if any), and the testing matrix for plan state.

---

## OUTPUT FORMAT

```
# <Plan Name> - Creative Assets Pack

**Prepared:** <date>
**Campaign:** <test name, budget>
**Platforms:** Google Search | Google Display Network | Meta Ads

---

## VISUAL DIRECTION
### Hook 1: <name>
<concept paragraph: scene, color, emotion, text overlay>
### Hook 2: <name>
<concept paragraph>

---

## FUNNEL COVERAGE AND BUILD MODE
**Funnel coverage:** <BOFU only / BOFU + MOFU / Full funnel>. **Build mode:** <Test-only / Build-to-scale>.
**Layer to creative pressure.** BOFU: <offer and CTA led>. MOFU: <proof and comparison led>. TOFU: <problem and attention led>.
**Scale-ready variant set:** <variants produced now and held for the scale run, or none>

---

## IMAGE CONCEPTS AND PROMPTS
### <Ad group / ad set> — Hook 1
**Concept:** <...>
**Prompt:**
```
<subject, scene, medium, style, lighting, composition, ratio, text overlay, negative>
```
**Fallback:** <second angle>
**Ratios:** 1.91:1, 1:1, 4:5 (Display) / 1:1, 4:5, 9:16 (Meta)

### <Ad group / ad set> — Hook 2
<same structure>

[repeat]

---

## VIDEO SCRIPTS
### <Hook> — 15 second cut
**Hook line:** <first 3 seconds>
**Storyboard:**
| Timecode | Visual | On-screen text | Voiceover | Audio |
|---|---|---|---|---|
**Voiceover script:** <line by line>
**Captions:** <subtitle text>
**CTA end-card:** <...>
**Ratios:** 1:1, 4:5, 9:16, 16:9
**Production notes:** <...>

### <Hook> — 30 second cut
<same structure>

---

## PER-AD-GROUP / PER-AD-SET CREATIVE PACK
| Ad group / ad set | Layer | Hook | Copy source | Image A | Image B | Video (15s) | Video (30s) | Ratio set | Notes |
|---|---|---|---|---|---|---|---|---|---|

---

## CREATIVE TESTING MATRIX
| Hook | Format | Platform | Variants | Metric | Winner criteria |
|---|---|---|---|---|---|

---

## PRODUCTION AND UPLOAD CHECKLIST
- [ ] <spec item>

---

## GENERATED FILES
<paths to generated images/videos if any, else "prompts ready for external generation">
```

---

## EDGE CASES

- **No brand assets supplied:** Ask for logo, colors, and fonts before writing prompts that reference them. If unavailable, use neutral brand-safe prompts and flag that the assets must be added later.
- **Image generation unavailable:** Deliver prompts only, marked "ready to run in your generator of choice." Never fake an image.
- **No product screenshots:** Do not invent an interface. Describe UI-free visual concepts (person, scene, text card) or ask the user for a screenshot.
- **Video production not needed (e.g. Google Search only):** Skip video scripts; note that Search is text-only.
- **User adds a platform with video (e.g. TikTok):** Add its ratio set and a script variant for it.
- **AI-generated images:** Never state "AI-generated" in the ad or landing copy.
- **Funnel coverage or build mode is not in state:** Ask the user to confirm both before defining the visual direction. The layer sets the creative pressure and the build mode sets the variant count.
- **A TOFU/MOFU ad set is asked for an offer-led creative:** Refuse the mismatch; keep the creative at the layer's pressure and move the offer-led variant to the BOFU set.
