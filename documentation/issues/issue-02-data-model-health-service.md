# Issue #2 — `DataModelHealthService` singleton

**Labels:** `backend` `service` `critical`
**Size:** Medium | **Track:** Intelligence | **Depends on:** #1
**Epic:** [EPIC] Intelligent Data Model Health Enforcement & Large Dataset Protection

---

## Description

Create a new singleton `DataModelHealthService` at `backend/src/services/DataModelHealthService.ts`. This service is the brain of the health enforcement system. It analyses the parsed `query` JSON object and produces a structured health report purely from that JSON plus source table metadata from `dra_table_metadata`.

**The service is pure logic** — no database writes, fully testable in isolation. The only DB call is `resolveSourceTableMeta()` which reads from `dra_table_metadata`.

### Analysis logic — structural facts extracted from `queryJSON`

```typescript
const hasAggregation =
    queryJSON.query_options.group_by?.aggregate_functions?.length > 0 ||
    queryJSON.query_options.group_by?.aggregate_expressions?.length > 0;

const hasGroupBy =
    queryJSON.query_options.group_by?.group_by_columns?.length > 0;

const hasWhere = queryJSON.query_options.where?.length > 0;

const totalSourceRows = sourceTableMeta.reduce((sum, t) => sum + (t.rowCount ?? 0), 0);
```

### Classification matrix

| Condition | `health_status` | Issue code |
|---|---|---|
| `modelType === 'dimension'` | `healthy` | none |
| `hasAggregation` | `healthy` | none |
| `!hasAggregation && hasGroupBy` | `warning` | `MISSING_AGGREGATE_FUNCTION` |
| `!hasAggregation && hasWhere && totalSourceRows <= largeSourceThreshold` | `warning` | `NO_AGGREGATION_WITH_FILTER` |
| `!hasAggregation && !hasWhere && totalSourceRows <= largeSourceThreshold` | `warning` | `NO_AGGREGATION_NO_FILTER_SMALL_SOURCE` |
| `!hasAggregation && !hasWhere && totalSourceRows > largeSourceThreshold` | `blocked` | `FULL_TABLE_SCAN_LARGE_SOURCE` |
| `!hasAggregation && hasWhere && totalSourceRows > largeSourceThreshold` | `warning` | `FILTER_WITHOUT_AGGREGATION_LARGE_SOURCE` |

Each `IHealthIssue` contains `code`, `severity` (`'info' | 'warning' | 'error'`), `title`, `description`, and `recommendation`.

### Methods

- `analyse(queryJSON, modelType, sourceMeta, threshold, largeSourceThreshold): IDataModelHealthReport`
- `resolveSourceTableMeta(queryJSON): Promise<ISourceTableMeta[]>` — reads `dra_table_metadata` for all unique source tables in the query JSON
- `recomputeAndPersist(dataModelId): Promise<IDataModelHealthReport>` — runs `SELECT COUNT(*)` on the local physical table, re-runs analysis, saves updated fields to `dra_data_models` (used by Issues #4 and #12)

---

## Acceptance Criteria

- [ ] `DataModelHealthService` singleton created following the existing singleton pattern
- [ ] `IDataModelHealthReport`, `IHealthIssue`, `ISourceTableMeta` types defined in `backend/src/types/IDataModelHealth.ts`
- [ ] All seven classification conditions produce the correct `health_status` and issue codes
- [ ] `analyse()` returns `healthy` immediately when `modelType === 'dimension'`
- [ ] `resolveSourceTableMeta()` queries `dra_table_metadata` using the `(schema, physical_table_name)` pair from each unique source table in `queryJSON.columns`
- [ ] Unit tests covering each classification row in the matrix
- [ ] `recomputeAndPersist()` updates `row_count`, `health_status`, `health_issues`, `source_row_count` on the `DRADataModel` row

---

## Files to Change

- `backend/src/services/DataModelHealthService.ts` — **new file**
- `backend/src/types/IDataModelHealth.ts` — **new types file**
