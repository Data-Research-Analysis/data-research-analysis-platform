# Data Quality Formulas and Calculations Reference

**Document Purpose:** Complete reference of all formulas, calculations, and validation logic used in the Data Quality Analysis system.

**Last Updated:** February 7, 2026

---

## Table of Contents
1. [Overall Quality Score](#overall-quality-score)
2. [Completeness Score](#completeness-score)
3. [Uniqueness Score](#uniqueness-score)
4. [Validity Score](#validity-score)
5. [Duplicate Detection](#duplicate-detection)
6. [Outlier Detection](#outlier-detection)
7. [Statistical Metrics](#statistical-metrics)
8. [Key Column Identification](#key-column-identification)
9. [Validation Patterns](#validation-patterns)

---

## Overall Quality Score

### Formula
```
Overall Score = ROUND((Completeness × 0.40) + (Validity × 0.35) + (Uniqueness × 0.25))
```

### Weights (Marketing Industry Optimized)
- **Completeness: 40%** - Critical for customer segmentation and targeting
- **Validity: 35%** - Accurate contact info prevents wasted ad spend
- **Uniqueness: 25%** - Deduplication avoids duplicate customer outreach

### Implementation
**Location:** `backend/src/processors/DataQualityProcessor.ts` (Lines 89-94)

```typescript
// Calculate overall quality score (weighted average)
// Weights optimized for marketing industry:
// - Completeness (40%): Critical for targeting and segmentation
// - Validity (35%): Accurate contact info prevents wasted ad spend
// - Uniqueness (25%): Deduplication avoids duplicate customer outreach
const overallScore = Math.round(
    scores.completenessScore * 0.40 +
    scores.validityScore * 0.35 +
    scores.uniquenessScore * 0.25
);
```

### Research Basis
Weights aligned with marketing data quality frameworks:
- Data-Driven Marketing (Mark Jeffery, 2010)
- Marketing Analytics Quality Framework (Teradata, 2018)
- Customer Data Platform standards emphasizing accurate contact info

---

## Completeness Score

### Formula
```
Completeness Score = ROUND(AVG(100 - Null Rate for each column))
```

### Sub-Calculation: Null Rate per Column
```
Null Rate = (Null Count / Total Rows) × 100
```

### Implementation
**Location:** `backend/src/services/DataQualityService.ts` (Lines 105-111, 218-232)

```typescript
// Calculate null rate for each column
const nullCount = /* count of NULL values */;
const totalRows = /* total rows in table */;
const nullRate = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;

// Calculate completeness per column
const completenessPerColumn = 100 - nullRate;

// Overall completeness score (average across all columns)
const completenessTotal = profile.columns.reduce((sum, col) => 
    sum + (100 - col.nullRate), 0
);
const completenessScore = Math.round(completenessTotal / columnCount);
```

### SQL Query
```sql
SELECT COUNT(*) as null_count 
FROM "${schema}"."${table_name}" 
WHERE "${column_name}" IS NULL
```

### Interpretation
- **100** = No missing values (perfect completeness)
- **80-99** = Good data coverage
- **60-79** = Moderate gaps
- **<60** = Significant missing data

---

## Uniqueness Score

### Formula
```
Uniqueness Score = ROUND(AVG(Distinct Rate for each column))
```

### Sub-Calculation: Distinct Rate per Column
```
Non-Null Rows = Total Rows - Null Count
Distinct Rate = (Distinct Count / Non-Null Rows) × 100
```

### Implementation
**Location:** `backend/src/services/DataQualityService.ts` (Lines 113-120, 224-228)

```typescript
// Get distinct count for column
const distinctCount = /* count of unique non-null values */;
const nonNullRows = totalRows - nullCount;
const distinctRate = nonNullRows > 0 ? (distinctCount / nonNullRows) * 100 : 0;

// Overall uniqueness score (average across all columns)
const uniquenessTotal = profile.columns.reduce((sum, col) => 
    sum + col.distinctRate, 0
);
const uniquenessScore = Math.round(uniquenessTotal / columnCount);
```

### SQL Query
```sql
SELECT COUNT(DISTINCT "${column_name}") as distinct_count 
FROM "${schema}"."${table_name}" 
WHERE "${column_name}" IS NOT NULL
```

### Interpretation
- **100** = All values unique (e.g., primary key)
- **80-99** = High cardinality (good for identifiers)
- **20-79** = Moderate cardinality (normal for categories)
- **<20** = Low cardinality (few distinct values)

### Note
Higher uniqueness is better for key columns but normal for categorical/enum fields. The average across all columns may overweight high-cardinality columns.

---

## Validity Score

### Formula
```
Validity Score = ROUND(AVG(Validity Rate for each column))
```

### Sub-Calculation: Validity Rate per Column
```
Validity Rate = ((Total Rows - Invalid Count) / Total Rows) × 100
```

### Implementation
**Location:** `backend/src/services/DataQualityService.ts` (Lines 230-234, 185-265)

```typescript
// Validate each column based on data type
const validation = await this.validateColumn(
    queryRunner, schema, tableName, columnName, dataType, totalRows
);

// Validity rate per column
const validityRate = totalRows > 0 
    ? ((totalRows - invalidCount) / totalRows) * 100 
    : 100;

// Overall validity score (average across all columns)
const validityTotal = profile.columns.reduce((sum, col) => 
    sum + col.validityRate, 0
);
const validityScore = Math.round(validityTotal / columnCount);
```

### Validation Logic by Data Type

#### 1. Numeric Types
**Types:** integer, bigint, smallint, decimal, numeric, real, double precision, money, int, int2, int4, int8, float4, float8

**Validation Regex:**
```regex
^-?[0-9]+(\.[0-9]+)?$
```

**SQL Query:**
```sql
SELECT COUNT(*) as invalid_count
FROM "${schema}"."${table_name}"
WHERE "${column_name}" IS NOT NULL
  AND "${column_name}"::text !~ '^-?[0-9]+(\.[0-9]+)?$'
```

#### 2. Date Types
**Types:** date, timestamp, timestamp without time zone, timestamp with time zone, time

**Validation Regex:**
```regex
^[0-9]{4}-[0-9]{2}-[0-9]{2}
```

**SQL Query:**
```sql
SELECT COUNT(*) as invalid_count
FROM "${schema}"."${table_name}"
WHERE "${column_name}" IS NOT NULL
  AND "${column_name}"::text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
```

#### 3. Email Fields (Marketing Critical)
**Trigger:** Column name contains 'email' or 'mail'

**Validation Regex:**
```regex
^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$
```

**SQL Query:**
```sql
SELECT COUNT(*) as invalid_count
FROM "${schema}"."${table_name}"
WHERE "${column_name}" IS NOT NULL
  AND "${column_name}" !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
```

**Examples:**
- ✅ Valid: `user@example.com`, `john.doe+tag@company.co.uk`
- ❌ Invalid: `user@`, `@example.com`, `user@.com`

#### 4. Phone Fields (Marketing Critical)
**Trigger:** Column name contains 'phone', 'tel', or 'mobile'

**Validation Regex:**
```regex
^[+]?[0-9\s\-\(\)]{7,20}$
```

**SQL Query:**
```sql
SELECT COUNT(*) as invalid_count
FROM "${schema}"."${table_name}"
WHERE "${column_name}" IS NOT NULL
  AND "${column_name}" !~ '^[+]?[0-9\s\-\(\)]{7,20}$'
```

**Examples:**
- ✅ Valid: `+1-555-123-4567`, `(555) 123-4567`, `5551234567`
- ❌ Invalid: `123`, `abc-defg-hijk`, `+1 555 123 456789012345`

#### 5. URL Fields
**Trigger:** Column name contains 'url', 'link', or 'website'

**Validation Regex:**
```regex
^https?://[^\s/$.?#].[^\s]*$
```

**SQL Query:**
```sql
SELECT COUNT(*) as invalid_count
FROM "${schema}"."${table_name}"
WHERE "${column_name}" IS NOT NULL
  AND "${column_name}" !~* '^https?://[^\s/$.?#].[^\s]*$'
```

**Examples:**
- ✅ Valid: `https://example.com`, `http://site.com/path?query=1`
- ❌ Invalid: `example.com`, `ftp://site.com`, `https://`

### Interpretation
- **100** = All values conform to expected formats
- **95-99** = Minor format issues
- **80-94** = Significant format problems
- **<80** = Major data quality issues requiring immediate attention

---

## Duplicate Detection

### Formula
```
Duplicates = Number of groups with COUNT(*) > 1
Affected Rows = Total rows in duplicate groups
```

### Implementation
**Location:** `backend/src/services/DataQualityService.ts` (Lines 241-269)

```typescript
const result = await queryRunner.query(
    `SELECT 
        COUNT(*) as total_duplicates,
        SUM(dup_count) as affected_rows
     FROM (
        SELECT COUNT(*) as dup_count
        FROM ${fullyQualifiedTable}
        GROUP BY ${columnList}
        HAVING COUNT(*) > 1
     ) duplicates`
);

return {
    duplicateCount: parseInt(result[0].total_duplicates) || 0,
    affectedRows: parseInt(result[0].affected_rows) || 0
};
```

### SQL Logic Steps
1. **Group by key columns** - Groups rows by identified key columns
2. **Filter duplicates** - `HAVING COUNT(*) > 1` keeps only groups with duplicates
3. **Count groups** - `COUNT(*)` gives number of duplicate groups
4. **Sum affected rows** - `SUM(dup_count)` gives total duplicate rows

### Example
```
Data:
id | email
1  | user@example.com
2  | user@example.com
3  | other@example.com

Result:
- total_duplicates: 1 (email "user@example.com" appears twice)
- affected_rows: 2 (both rows with that email)
```

### Deduplication SQL
**Location:** `backend/src/processors/DataQualityProcessor.ts` (Lines 322-341)

```sql
BEGIN;

WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY ${keyColumns} ORDER BY ${orderBy}) as rn
    FROM ${table}
)
DELETE FROM ${table}
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

COMMIT;
```

**Logic:** 
- Assigns row number within each duplicate group
- Keeps first row (rn = 1)
- Deletes subsequent rows (rn > 1)

---

## Outlier Detection

### Method: IQR (Interquartile Range)
The IQR method is a standard statistical technique for identifying outliers based on quartile distribution.

### Formula
```
Q1 = 25th percentile
Q3 = 75th percentile
IQR = Q3 - Q1
Lower Bound = Q1 - (1.5 × IQR)
Upper Bound = Q3 + (1.5 × IQR)

Outlier = value < Lower Bound OR value > Upper Bound
```

### Implementation
**Location:** `backend/src/services/DataQualityService.ts` (Lines 275-311)

```typescript
// Calculate quartiles and IQR
const statsResult = await queryRunner.query(
    `SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${quotedColumn}) as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${quotedColumn}) as q3
     FROM ${fullyQualifiedTable}
     WHERE ${quotedColumn} IS NOT NULL`
);

const q1 = parseFloat(statsResult[0].q1);
const q3 = parseFloat(statsResult[0].q3);
const iqr = q3 - q1;
const lowerBound = q1 - (1.5 * iqr);
const upperBound = q3 + (1.5 * iqr);

// Count outliers
const outlierResult = await queryRunner.query(
    `SELECT COUNT(*) as outlier_count
     FROM ${fullyQualifiedTable}
     WHERE ${quotedColumn} IS NOT NULL
       AND (${quotedColumn} < $1 OR ${quotedColumn} > $2)`,
    [lowerBound, upperBound]
);

return {
    outlierCount: parseInt(outlierResult[0].outlier_count),
    lowerBound,
    upperBound
};
```

### Example Calculation
```
Data: [1, 2, 3, 4, 5, 6, 7, 8, 100]

Q1 = 2.5 (25th percentile)
Q3 = 7.5 (75th percentile)
IQR = 7.5 - 2.5 = 5
Lower Bound = 2.5 - (1.5 × 5) = -5
Upper Bound = 7.5 + (1.5 × 5) = 15

Outliers: 100 (exceeds upper bound of 15)
```

### Interpretation
- **1.5 × IQR** is the standard multiplier (Tukey's fences)
- More conservative: Use 3 × IQR
- More aggressive: Use 1 × IQR

---

## Statistical Metrics

### Numeric Columns
**Location:** `backend/src/services/DataQualityService.ts` (Lines 143-161)

```sql
SELECT 
    MIN(${quotedColumn}) as min_val,
    MAX(${quotedColumn}) as max_val,
    AVG(${quotedColumn}) as mean_val,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${quotedColumn}) as median_val,
    STDDEV(${quotedColumn}) as stddev_val
FROM ${fullyQualifiedTable}
WHERE ${quotedColumn} IS NOT NULL
```

#### Formulas
```
Mean = AVG(values)
Median = PERCENTILE_CONT(0.5)
Standard Deviation = STDDEV(values)
```

### Date Columns
**Location:** `backend/src/services/DataQualityService.ts` (Lines 164-179)

```sql
SELECT 
    MIN(${quotedColumn}) as min_val,
    MAX(${quotedColumn}) as max_val
FROM ${fullyQualifiedTable}
WHERE ${quotedColumn} IS NOT NULL
```

---

## Key Column Identification

### Purpose
Automatically identify columns suitable for duplicate detection (likely primary or unique keys).

### Criteria
**Location:** `backend/src/processors/DataQualityProcessor.ts` (Lines 246-264)

#### Statistical Criteria
```
Distinct Rate > 80% AND Null Rate < 10%
```

#### Pattern-Based Criteria
Column name contains (case-insensitive):
- `id`
- `email`
- `username`
- `code`
- `sku`

### Implementation
```typescript
for (const col of profile.columns) {
    // Statistical criteria
    if (col.distinctRate > 80 && col.nullRate < 10) {
        keyColumns.push(col.name);
    }
    
    // Pattern-based criteria
    const keyPatterns = ['id', 'email', 'username', 'code', 'sku'];
    if (keyPatterns.some(pattern => col.name.toLowerCase().includes(pattern))) {
        if (!keyColumns.includes(col.name)) {
            keyColumns.push(col.name);
        }
    }
}

return keyColumns.slice(0, 3); // Limit to 3 columns
```

### Example
```
Columns:
- user_id: distinct_rate=100%, null_rate=0% → Selected (statistical)
- email: distinct_rate=95%, null_rate=2% → Selected (statistical + pattern)
- name: distinct_rate=60%, null_rate=5% → Not selected
- order_code: distinct_rate=50%, null_rate=0% → Selected (pattern match for 'code')

Result: ["user_id", "email", "order_code"]
```

---

## Validation Patterns

### Data Type Classifications

#### Numeric Types
```
integer, bigint, smallint, decimal, numeric,
real, double precision, money, int, int2, int4, int8,
float4, float8
```

#### Date Types
```
date, timestamp, timestamp without time zone,
timestamp with time zone, time, time without time zone,
time with time zone
```

#### Text Types
```
character varying, varchar, character, char, text, string
```

### Pattern Matching

All regex patterns use PostgreSQL's `~` (case-sensitive) or `~*` (case-insensitive) operators.

#### Email Pattern
```regex
^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$
```
- Allows alphanumeric + `._%+-` before @
- Allows alphanumeric + `.-` in domain
- Requires TLD of at least 2 characters

#### Phone Pattern
```regex
^[+]?[0-9\s\-\(\)]{7,20}$
```
- Optional leading +
- Allows digits, spaces, hyphens, parentheses
- Length: 7-20 characters

#### URL Pattern
```regex
^https?://[^\s/$.?#].[^\s]*$
```
- Requires http:// or https://
- No whitespace allowed
- Must have domain and path

#### Numeric Pattern
```regex
^-?[0-9]+(\.[0-9]+)?$
```
- Optional negative sign
- One or more digits
- Optional decimal point with digits

#### Date Pattern
```regex
^[0-9]{4}-[0-9]{2}-[0-9]{2}
```
- YYYY-MM-DD format
- Basic ISO 8601 validation

---

## Imputation Methods

### Mean Imputation
**Location:** `backend/src/processors/DataQualityProcessor.ts` (Lines 451-459)

```sql
UPDATE ${table}
SET ${quotedColumn} = (SELECT AVG(${quotedColumn}) FROM ${table} WHERE ${quotedColumn} IS NOT NULL)
WHERE ${quotedColumn} IS NULL;
```

**Use Case:** Numeric columns without significant outliers

### Median Imputation
**Location:** `backend/src/processors/DataQualityProcessor.ts` (Lines 460-468)

```sql
UPDATE ${table}
SET ${quotedColumn} = (
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${quotedColumn})
    FROM ${table}
    WHERE ${quotedColumn} IS NOT NULL
)
WHERE ${quotedColumn} IS NULL;
```

**Use Case:** Numeric columns with outliers (more robust than mean)

---

## Fix Time Estimation

### Formula
**Location:** `backend/src/processors/DataQualityProcessor.ts` (Lines 289-292)

```
Estimated Time (seconds) = CEIL(Total Rows / 10,000)
```

### Implementation
```typescript
private estimateFixTime(totalRows: number): number {
    // Rough estimate: 1 second per 10,000 rows
    return Math.ceil(totalRows / 10000);
}
```

### Example
```
100 rows → 1 second
10,000 rows → 1 second
50,000 rows → 5 seconds
1,000,000 rows → 100 seconds (1.67 minutes)
```

---

## Summary of Potential Issues

### 1. Uniqueness Score Weighting
**Issue:** Averaging distinct rates across all columns may overweight high-cardinality columns.

**Example:**
```
Column 1 (ID): distinct_rate = 100%
Column 2 (Name): distinct_rate = 80%
Column 3 (Category): distinct_rate = 10% (only 5 categories)

Uniqueness Score = (100 + 80 + 10) / 3 = 63%
```

**Consideration:** For marketing data with many categorical fields (country, status, source), this may underrepresent normal data patterns.

### 2. Email Regex Limitations
**Current Pattern:** `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`

**Missing Cases:**
- Quoted strings: `"john..doe"@example.com`
- Unicode characters: `用户@例え.jp`
- IP addresses: `user@[192.168.1.1]`

**Recommendation:** Use a more comprehensive RFC 5322 pattern for production.

### 3. Phone Validation
**Current Pattern:** `^[+]?[0-9\s\-\(\)]{7,20}$`

**Limitations:**
- No country code validation
- Allows invalid formats like `(123)456----7890`
- No minimum digit count

**Recommendation:** Consider integration with libphonenumber for proper international phone validation.

### 4. Date Validation
**Current Pattern:** `^[0-9]{4}-[0-9]{2}-[0-9]{2}`

**Limitations:**
- Accepts invalid dates like `2023-13-45`
- No timezone validation
- Only checks format, not actual date validity

**Recommendation:** Use PostgreSQL's date casting with error handling for true validation.

---

## Testing Recommendations

### Unit Tests Needed
1. Edge cases for all regex patterns
2. Boundary conditions for IQR outlier detection
3. Division by zero handling (empty tables, single-value columns)
4. NULL handling in all calculations
5. Unicode and special characters in text validation

### Integration Tests Needed
1. Full analysis on sample marketing datasets
2. Performance testing with large tables (1M+ rows)
3. Cross-database validation (PostgreSQL, MySQL, MariaDB)
4. Concurrent analysis requests

### Validation Datasets
Create test datasets with:
- Known duplicate counts
- Known outlier counts
- Various email/phone formats
- Edge case values (empty strings, special characters)
- International formats (non-US dates, phones)

---

## References

### Academic Sources
- Wang, R.Y., & Strong, D.M. (1996). "Beyond Accuracy: What Data Quality Means to Data Consumers"
- Batini, C., et al. (2009). "Methodologies for data quality assessment and improvement"
- Tukey, J.W. (1977). "Exploratory Data Analysis" (IQR method)

### Industry Standards
- Data-Driven Marketing (Mark Jeffery, 2010)
- Marketing Analytics Quality Framework (Teradata, 2018)
- RFC 5322 (Email format specification)
- ISO 8601 (Date/time format specification)

### Code Locations
- **Backend Processor:** `backend/src/processors/DataQualityProcessor.ts`
- **Quality Service:** `backend/src/services/DataQualityService.ts`
- **Interfaces:** `backend/src/interfaces/IDataQuality.ts`
- **Frontend Component:** `frontend/components/DataQualityPanel.vue`

---

**Document Version:** 1.0  
**Generated:** February 7, 2026  
**Review Status:** Pending validation with test datasets
