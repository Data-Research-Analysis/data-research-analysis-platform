# Paid Media skill packs

This directory holds the 17 vendored paid-media skills (the orchestrator intake/plan-index steps plus the 16 `pm-*` step skills) as platform-facing skill packs. It lives under `backend/skills/` so the runtime backend (which mounts only the `backend/` directory in Docker) can load it without extra mounts.

Each numbered directory contains:

- `SKILL.md` — the verbatim skill definition (single authoring source, copied from the author workspace during implementation).
- `manifest.json` — the machine-readable contract loaded by `SkillRegistryService` at boot (step order, tools, gates, artifacts, state writes, output contract).

`_shared/orchestrator.md` is the verbatim paid-media-plan master skill. Steps 0 (`intake`) and 16 (`plan-index`) run under that definition. `_shared/tools.md` documents the Skill Runner tool surface and `_shared/guardrails.md` the shared brand-guardrail rules applied to copy steps.

The manifests are generated deterministically by `tools/generate-skill-manifests.mjs`. After editing any skill content, regenerate the manifests and keep them in sync:

```bash
node tools/generate-skill-manifests.mjs
```

The runner never reads the author workspace. Skill content is loaded from this directory at runtime.
