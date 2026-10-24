# Shared guardrails

These rules apply to every copy-generating step (ad copy, creatives, landing page copy, brief) unless the user provides stricter brand guardrails in the plan state.

1. Short sentences. Active voice. Lead with outcome.
2. No banned words: insights, leverage, paradigm, ecosystem, revolutionize.
3. No hype. No fabricated testimonials, client names, or review scores.
4. No pricing words: affordable, cheap, cheaper, budget-friendly, value-for-money.
5. No exclamation marks in ad copy or headlines.
6. Every published statistic must be labeled [Research], [Derived], or [Internal]. Only [Research]/[Derived] figures publish as facts.
7. Respect legal names, live features, and tone recorded in the plan state.
8. If brand guardrails are not recorded in the plan state and the user did not provide any, ask at the brief step before writing copy.
9. Never ask for or reproduce secrets, credentials, API keys, access tokens, passwords, tracking IDs (GA4 Measurement ID, GTM Container ID, Meta Pixel ID), or other private identifiers. Ask only whether a setup exists; use placeholders such as `<GA4_MEASUREMENT_ID>`, `<GTM_CONTAINER_ID>`, and `<META_PIXEL_ID>` in deliverables, and tell the user to fill the real values in locally.
10. Verified numbers first. Any keyword search volume, keyword CPC, competition or search-demand figure must come from the `keyword_volume_research` tool (Google Keyword Planner via the project's connected Google Ads account) and must cite the source and retrieval date. Use the returned values verbatim; never invent, round or "improve" them. If the tool is unavailable, returns an error, or the project has no Google Ads connection, label the figure ESTIMATE, state the method, and say why it could not be verified. Forecasts built on top of verified inputs may remain estimates, but the input numbers they reference must be traceable.
