# Issue #3 — Platform settings: `max_data_model_rows` + `large_source_table_threshold`

**Labels:** `backend` `config` `critical`
**Size:** Small | **Track:** Enforcement | **Depends on:** nothing
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

Add two new configurable thresholds to `dra_platform_settings`. Both are immediately adjustable by an admin from the existing platform settings page without any frontend changes (the page renders all settings dynamically).

| Key | Default | Purpose |
|---|---|---|
| `max_data_model_rows` | `50000` | Hard block: output row count above this prevents chart queries (HTTP 422) |
| `large_source_table_threshold` | `100000` | Source table row count above this triggers `FULL_TABLE_SCAN_LARGE_SOURCE` in health analysis |

Setting `max_data_model_rows` to `0` disables enforcement entirely (escape hatch for admins).

---

## Acceptance Criteria

- [ ] Both settings added to the platform settings seeder
- [ ] Both appear in the existing admin platform settings UI under the `features` category
- [ ] `PlatformSettingsService.getInstance().getNumber('max_data_model_rows', 50000)` is used everywhere the threshold is needed (never hardcoded)
- [ ] Setting `max_data_model_rows = 0` disables the backend hard block in Issue #8

---

## Files to Change

- `backend/src/seeders/` — two new entries in the platform settings seeder
