# Data Model Composition - User Guide

## Table of Contents

1. [Overview](#overview)
   - [Why Composition Matters](#why-composition-matters)
2. [Use Cases](#use-cases)
3. [How It Works](#how-it-works)
   - [Architecture](#architecture)
   - [Visual Indicators](#visual-indicators)
   - [Column Naming Convention](#column-naming-convention)
4. [Creating Data Models from Data Models](#creating-data-models-from-data-models)
   - [Step-by-Step Workflow](#step-by-step-workflow)
5. [Best Practices](#best-practices)
6. [Medallion Architecture - Data Quality Layers](#medallion-architecture---data-quality-layers)
   - [The Three Layers](#the-three-layers)
     - [Bronze Layer - Raw Data](#-bronze-layer---raw-data)
     - [Silver Layer - Clean Data](#-silver-layer---clean-data)
     - [Gold Layer - Business Ready](#-gold-layer---business-ready)
   - [Layer Assignment](#layer-assignment)
   - [Migration Wizard - Bulk Classification](#migration-wizard---bulk-classification)
   - [Composition Layer Recommendations](#composition-layer-recommendations)
   - [Layer Badges - Visual Indicators](#layer-badges---visual-indicators)
   - [Best Practices for Layer Progression](#best-practices-for-layer-progression)
   - [Validation Rules Reference](#validation-rules-reference)
   - [Health Check Integration](#health-check-integration)
   - [Troubleshooting & FAQ](#troubleshooting--faq)
   - [Migration Checklist for Existing Projects](#migration-checklist-for-existing-projects)
7. [AI Data Modeler Integration](#ai-data-modeler-integration)
8. [Troubleshooting & FAQ (General)](#troubleshooting--faq)
9. [Technical Architecture Summary](#technical-architecture-summary)
10. [Migration Guide](#migration-guide)
11. [Future Enhancements](#future-enhancements-planned)
12. [Support & Feedback](#support--feedback)

---

## Overview

Data Model Composition is a powerful feature that enables staged, layered analytics by allowing you to build new data models **from existing data models** — not just raw source tables.

### Why Composition Matters

Traditional data modeling limits you to working with raw source tables. This forces you to:
- Re-implement complex joins and aggregations for every new analysis
- Manage increasingly complex queries as analysis deepens
- Lose performance optimizations from previous work
- Create monolithic queries that are hard to debug and maintain

Data Model Composition breaks this limitation by treating **existing data models as reusable building blocks**, enabling:

✅ **Staged Analytics**: Build refined metrics on top of base metrics  
✅ **Reusable Logic**: Use existing joins and aggregations as foundations  
✅ **Improved Performance**: Pre-computed materialized models are faster than re-computing from raw tables  
✅ **Simplified Maintenance**: Change a base model once, all dependent models inherit the update  
✅ **Better Organization**: Logical layers (bronze → silver → gold) for clearer data architecture  

---

## Use Cases

### 1. Layered Metrics
Build progressively refined metrics:

**Layer 1** (Base): Revenue by customer by month (from orders + customers tables)  
**Layer 2** (Derived): Year-over-year revenue growth (from Layer 1 model)  
**Layer 3** (Advanced): Customer lifetime value segments (from Layer 2 model)

### 2. Reusing Complex Joins
If you've already created a model joining orders+customers+products+shipping, use it as a foundation for:
- Regional sales analysis
- Product performance trends
- Customer segmentation
- Shipping efficiency metrics

### 3. Cross-Source Analytics
Build on top of cross-source models:

**Base Model**: Combined Google Analytics + Shopify sales data  
**Derived Model**: Marketing attribution with conversion tracking (from base cross-source model)

### 4. Incremental Refinement
Start broad, then drill down:

**Model 1**: All website events from Google Analytics  
**Model 2**: Filter to purchase events only (from Model 1)  
**Model 3**: Add purchase cohorts by channel (from Model 2)

---

## How It Works

### Architecture

When you build a data model from another data model:

1. **Lineage Tracking**: The system automatically detects dependencies by analyzing column names in your query
2. **Materialized Storage**: The new model is saved as a physical table, just like source-based models
3. **Metadata Capture**: Parent-child relationships are recorded in the database
4. **Staleness Detection**: The system monitors when parent models are refreshed

### Visual Indicators

The Data Model Builder sidebar now has **two collapsible sections**:

#### 📊 Data Sources (Green Gradient)
Your raw tables from connected data sources (PostgreSQL, Excel, Google Analytics, etc.)

#### 🧩 Data Models (Purple/Pink Gradient)
Your existing data models, shown with:
- **Logical Name**: `[Data Model] Display Name`
- **Row Count**: Size of the materialized table
- **Health Status**: `healthy`, `warning`, `stale`
- **Model Type**: `star_schema`, `obt`, `custom`, etc.
- **Last Refreshed**: When the model was last rebuilt

### Column Naming Convention

When you add columns from data models to a new model, they follow the same format as source tables:
- **Format**: `tableName_columnName`
- **Example**: `data_model_customer_metrics_abc123_customer_id`

This ensures consistent naming across all column sources.

---

## Creating Data Models from Data Models

### Step-by-Step Workflow

#### 1. Open the Data Model Builder
Navigate to your project → Data Sources → Select a source → "Create Data Model"

#### 2. Review Available Sources
The sidebar shows two sections:
- **Data Sources**: Raw tables from your connections
- **Data Models**: Pre-built models from this project

Expand the **Data Models** section to see existing models with their columns.

#### 3. Select Columns
Drag columns from **either** section:
- Drag from Data Sources for raw data
- Drag from Data Models for pre-computed metrics/joins

You can mix columns from both source tables AND data models in the same query.

#### 4. Build Your Query
Use the visual query builder or Advanced Mode to:
- Add filters (WHERE clauses)
- Define joins (if combining multiple sources)
- Add aggregations (SUM, COUNT, AVG, etc.)
- Create calculated columns

#### 5. Preview & Save
Click "Execute Query" to preview results, then "Save Data Model" to materialize it.

#### 6. Staleness Warning ⚠️
If a parent data model is refreshed after you build your child model, an **orange staleness banner** appears:

> **Source Data Models Have Been Updated**
> 
> This data model uses other data models as sources, and those parent models have been refreshed since this model was last built. The data in this model may be outdated.
> 
> **Updated Parent Models:**
> - [Data Model] Customer Metrics (refreshed 2 hours ago)
> 
> [Rebuild This Model Now] [Dismiss]

Click **Rebuild This Model Now** to refresh the child model with updated parent data.

---

## Best Practices

### ✅ DO

1. **Start with a Strong Foundation**
   - Build base models with clean joins and validated data
   - Document what each base model represents

2. **Use Logical Layering**
   - **Bronze**: Raw source tables (minimal transformation)
   - **Silver**: Cleaned, joined, deduplicated models (from Bronze)
   - **Gold**: Aggregated, business-ready metrics (from Silver)

3. **Name Models Clearly**
   - Use descriptive names: "Customer Lifetime Value", "Monthly Revenue by Region"
   - Avoid generic names: "Model 1", "Test Query"

4. **Monitor Health Status**
   - Regularly check the Data Models list for stale or unhealthy models
   - Rebuild dependent models after refreshing base models

5. **Rebuild Stale Models**
   - When you see the staleness warning, rebuild promptly
   - Stale data can lead to incorrect analysis

### ❌ DON'T

1. **Don't Create Circular Dependencies**
   - Model A depends on Model B + Model B depends on Model A = ❌
   - The system will log a warning and prevent the circular relationship

2. **Don't Ignore Staleness Warnings**
   - Stale models contain outdated data
   - Always investigate before dismissing

3. **Don't Over-Layer**
   - More than 3-4 layers deep can become hard to debug
   - Each layer adds query complexity - balance reusability with simplicity

4. **Don't Mix Incompatible Schemas**
   - Cross-source models require explicit joins
   - Ensure data models used together have compatible schemas

---

## Medallion Architecture - Data Quality Layers

### Overview

The platform implements a **Medallion Architecture** layer classification system that organizes data models into three tiers based on data quality and transformation level:

🟤 **Bronze** (Raw Data) → 🥈 **Silver** (Clean Data) → 🥇 **Gold** (Business Ready)

This architecture provides:
- **Clear Quality Indicators**: Instantly know the refinement level of any model
- **Guided Progression**: AI-powered recommendations for layer assignment
- **Validation Rules**: Automated checks ensure models are correctly classified
- **Flow Warnings**: Alerts when composition patterns violate standard progression
- **Migration Tools**: Bulk classification wizard for existing models

### The Three Layers

#### 🟤 Bronze Layer - Raw Data

**Purpose**: Minimal transformation of source data for initial landing/staging

**Characteristics**:
- Direct mapping from source tables
- Minimal to no filtering
- No aggregations or complex transformations
- Column renaming/reordering is allowed
- Data type casting is allowed

**Query Requirements**:
- ✅ Simple SELECT with column selection
- ✅ Basic WHERE clauses for partitioning (e.g., date ranges)
- ✅ Column aliasing and CAST operations
- ❌ No joins (single source only)
- ❌ No aggregations (GROUP BY, SUM, COUNT, etc.)
- ❌ No complex CASE statements or calculations

**Example Bronze Models**:
```sql
-- Bronze: Raw customer data with basic type casting
SELECT 
    CAST(customer_id AS INTEGER) AS customer_id,
    customer_name,
    email,
    CAST(created_at AS TIMESTAMP) AS created_at
FROM raw_customers
WHERE created_at >= '2024-01-01'
```

**Badge Color**: Brown/Bronze gradient

---

#### 🥈 Silver Layer - Clean Data

**Purpose**: Cleaned, deduplicated, and standardized data ready for analysis

**Characteristics**:
- Filtering out invalid/test records
- Deduplication logic
- Standardization (consistent formatting, null handling)
- Data quality improvements
- Can join multiple sources
- Moderate transformations

**Query Requirements**:
- ✅ Filtering (WHERE clauses with business logic)
- ✅ Joins (INNER, LEFT, FULL)
- ✅ Deduplication (ROW_NUMBER, DISTINCT)
- ✅ CASE statements for standardization
- ✅ String manipulation (CONCAT, SUBSTRING, etc.)
- ✅ NULL handling (COALESCE, NULLIF)
- ❌ No aggregations (GROUP BY, SUM, COUNT)
- ❌ No business metrics or KPIs

**Example Silver Models**:
```sql
-- Silver: Cleaned customer orders with joined product details
SELECT 
    o.order_id,
    o.customer_id,
    p.product_name,
    p.category,
    o.order_date,
    COALESCE(o.shipping_address, c.default_address) AS shipping_address,
    CASE 
        WHEN o.status = 'completed' THEN 'fulfilled'
        WHEN o.status = 'shipped' THEN 'in_transit'
        ELSE 'pending'
    END AS order_status
FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN products p ON o.product_id = p.product_id
WHERE o.is_test_order = false
    AND o.order_date >= '2023-01-01'
```

**Badge Color**: Silver gradient

---

#### 🥇 Gold Layer - Business Ready

**Purpose**: Aggregated business metrics, KPIs, and analytics-ready datasets

**Characteristics**:
- Aggregations (SUM, COUNT, AVG, etc.)
- Business logic and KPI calculations
- Complex analytical functions (window functions, LAG, LEAD)
- Metrics ready for reporting/dashboards
- Often built on top of Silver layer models

**Query Requirements**:
- ✅ Aggregations (GROUP BY, SUM, COUNT, AVG)
- ✅ Window functions (RANK, ROW_NUMBER, LAG, LEAD)
- ✅ Complex calculations (growth rates, percentages, ratios)
- ✅ Business logic (commission calculations, segment assignment)
- ✅ Multiple CTEs for staged computations
- ✅ All features from Bronze/Silver layers

**Example Gold Models**:
```sql
-- Gold: Customer lifetime value with cohorts
SELECT 
    customer_id,
    customer_name,
    COUNT(DISTINCT order_id) AS total_orders,
    SUM(order_value) AS lifetime_value,
    AVG(order_value) AS avg_order_value,
    MIN(order_date) AS first_order_date,
    MAX(order_date) AS last_order_date,
    CASE 
        WHEN SUM(order_value) >= 10000 THEN 'VIP'
        WHEN SUM(order_value) >= 5000 THEN 'High Value'
        WHEN SUM(order_value) >= 1000 THEN 'Medium Value'
        ELSE 'Low Value'
    END AS customer_segment
FROM cleaned_customer_orders  -- Silver layer model
GROUP BY customer_id, customer_name
HAVING COUNT(DISTINCT order_id) >= 2
```

**Badge Color**: Gold gradient

---

### Layer Assignment

#### Manual Classification

When creating or editing a data model:

1. Click the **Layer** dropdown selector
2. Choose from:
   - **Bronze** - Raw Data
   - **Silver** - Clean Data
   - **Gold** - Business Ready
3. The system validates your query structure against layer rules
4. If validation fails, you'll see an error message explaining why

**Validation Feedback**:
- ✅ **Valid**: "This query structure is appropriate for the Silver layer"
- ❌ **Invalid**: "Cannot assign Gold layer: Query contains aggregations but no GROUP BY"

#### AI-Powered Recommendations

When creating a new model:

1. Build your query in the Data Model Builder
2. Before saving, the AI analyzes your query structure
3. A **recommendation badge** appears suggesting the appropriate layer
4. Hover over the badge to see the reasoning:
   - "Contains joins and filtering but no aggregations → Silver layer recommended"
   - "Contains GROUP BY with SUM/COUNT → Gold layer recommended"
5. You can accept the recommendation or choose a different layer

---

### Migration Wizard - Bulk Classification

For projects with existing unclassified data models, use the **Layer Migration Wizard** to assign layers in bulk.

#### When to Use

An **amber banner** appears at the top of the Data Models list when unclassified models exist:

> **🏷️ Classify Your Data Models**
> 
> You have **12 unclassified data models**. Use the Layer Migration Wizard to assign Bronze, Silver, or Gold layers based on AI recommendations and improve data quality visibility.
> 
> [Open Migration Wizard]

#### Wizard Workflow

**Step 1: Review Candidates**

The wizard displays a table of all unclassified models:

| Model Name | Type | Rows | AI Recommendation | Confidence | Actions |
|------------|------|------|-------------------|------------|---------|
| Customer Order History | Star Schema | 45,230 | 🥈 Silver | High | ℹ️ ✅ |
| Monthly Revenue Summary | Custom | 12 | 🥇 Gold | High | ℹ️ ✅ |
| Raw Google Analytics Events | OBT | 1.2M | 🟤 Bronze | Medium | ℹ️ ✅ |

**Step 2: Review AI Reasoning**

Click the **ℹ️ info icon** to see why the AI recommended each layer:

> **Silver Layer Recommended (High Confidence)**
> 
> - Query contains JOIN operations
> - Filtering with WHERE clause detected
> - No aggregations (GROUP BY) found
> - No complex business logic metrics
> 
> **Pattern**: Clean, joined data without aggregations → Silver layer

**Step 3: Select Models**

- Check individual models to classify
- Use **Select All** to bulk-select all unclassified models
- Models will be assigned their AI-recommended layer

**Step 4: Apply Classifications**

Click **Apply Layer Classifications** to save.

**Results**:
- ✅ **Success**: "Successfully classified 10 data models"
- ⚠️ **Partial**: "Classified 8 of 10 models. 2 validations failed"
- ❌ **Failure**: "Failed to classify models. Please try again"

The wizard shows per-model results if any validations fail.

**Step 5: Auto-Refresh**

After successful classification:
- The Data Models list automatically refreshes
- Layer badges appear on newly classified models
- The amber banner disappears
- Models are now tracked in health checks

---

### Composition Layer Recommendations

When building a data model **from other data models**, the system provides **real-time layer recommendations** based on the source models' layers.

#### How It Works

1. **Detection**: The system detects when you add columns from existing data models (schema prefix check)
2. **Analysis**: Determines the layers of all source models in your composition
3. **Recommendation**: Suggests the appropriate next layer based on progression rules
4. **Display**: Shows a **purple recommendation banner** with reasoning

#### Progression Rules

The system follows standard Medallion Architecture flow patterns:

| Source Model Layer(s) | Recommended Layer | Reasoning |
|----------------------|-------------------|-----------|
| Bronze only | 🥈 Silver | Clean and standardize raw data |
| Silver only | 🥇 Gold | Aggregate clean data into business metrics |
| Gold only | 🥇 Gold | Further refine business metrics |
| Mixed (Bronze + Silver) | 🥈 Silver | Use highest source layer |
| Mixed (Silver + Gold) | 🥇 Gold | Use highest source layer |
| Unclassified sources | 🥈 Silver | Default to Clean Data layer |

#### Recommendation Banner

When composing data models, a banner appears:

> **🎯 Layer Recommendation**
> 
> **Suggested Layer**: 🥇 Gold - Business Ready
> 
> **Reasoning**: You're composing from Clean Data (Silver) models. The recommended next step is to aggregate these into business metrics (Gold layer).
> 
> **Source Models**:
> - 🥈 Customer Order History (Silver)
> - 🥈 Product Performance Metrics (Silver)
> 
> [Apply Recommendation]

Click **Apply Recommendation** to auto-select the suggested layer.

#### Flow Warnings

If your composition doesn't follow standard patterns, a **warning box** appears:

> ⚠️ **Non-Standard Flow Detected**
> 
> You're composing a Silver layer model from Gold layer sources. This is valid but unusual. Typically:
> - Bronze → Silver → Gold (standard progression)
> - Gold → Gold (metric refinement)
> 
> Consider if this flow is intentional or if a different layer is more appropriate.

**Common Warning Scenarios**:
- Building Bronze from Silver/Gold (going backwards)
- Building Silver from Gold (regression)
- Mixing many unclassified sources

---

### Layer Badges - Visual Indicators

Layer badges appear throughout the platform wherever data models are displayed:

#### Badge Design

**Bronze**: Brown/bronze gradient pill badge with "Bronze" text  
**Silver**: Silver/gray gradient pill badge with "Silver" text  
**Gold**: Gold/yellow gradient pill badge with "Gold" text  

#### Locations

1. **Data Models List**: Badge next to each model's name
2. **Data Model Builder Sidebar**: Badge on each data model card
3. **Model Detail Page**: Badge in the header
4. **AI Chat Interface**: Badge when referencing models
5. **Health Check Reports**: Badge in model lineage views
6. **Migration Wizard**: Badge showing recommendations

---

### Best Practices for Layer Progression

#### ✅ DO

1. **Follow the Natural Flow**
   - Bronze → Silver → Gold is the standard progression
   - Each layer builds on the previous one
   - Don't skip layers unnecessarily

2. **Use Explicit Naming**
   - Include the layer in model names: "Bronze: Raw Orders", "Silver: Cleaned Customer Data"
   - This helps team members understand model purpose at a glance

3. **Document Transformations**
   - In model descriptions, explain what transformations moved the data to the next layer
   - Example: "Silver: Applied deduplication logic, filtered test accounts, standardized addresses"

4. **Rebuild Dependent Models After Reclassification**
   - If you change a model's layer, check dependent models
   - Ensure the flow still makes sense

5. **Use Migration Wizard for Bulk Updates**
   - Don't manually classify dozens of models
   - Let the AI recommend, then review and apply in bulk

#### ❌ DON'T

1. **Don't Mix Layers Randomly**
   - Avoid: Bronze → Gold (skipping Silver)
   - Silver layer is for cleaning - use it

2. **Don't Classify Based on Name Alone**
   - The **query structure** determines the layer, not the model name
   - "Raw Orders" with aggregations is NOT Bronze

3. **Don't Ignore Validation Errors**
   - If the system says your query doesn't match the selected layer, investigate
   - Validation prevents misclassification

4. **Don't Build Bronze from Silver/Gold**
   - Bronze is for raw ingestion only
   - Don't compose Bronze models from refined data

5. **Don't Dismiss Flow Warnings Without Review**
   - Non-standard flows are sometimes correct, but usually indicate a mistake
   - Review the reasoning before proceeding

---

### Validation Rules Reference

#### Bronze Layer Validation

**Allowed**:
- SELECT with column selection
- WHERE clauses for partitioning
- CAST and type conversions
- Column aliasing
- LIMIT/OFFSET

**Not Allowed**:
- JOIN operations
- GROUP BY / aggregations
- Window functions
- Complex CASE statements (simple type-related CASE is OK)
- CTEs with transformations

**Error Examples**:
- ❌ "Cannot assign Bronze layer: Query contains JOIN operations"
- ❌ "Cannot assign Bronze layer: Query contains aggregations (GROUP BY)"

#### Silver Layer Validation

**Allowed**:
- All Bronze features
- JOIN operations (INNER, LEFT, RIGHT, FULL)
- WHERE with business logic
- CASE statements for standardization
- Deduplication (ROW_NUMBER, DISTINCT)
- String/date functions (CONCAT, SUBSTRING, DATE_TRUNC)
- NULL handling (COALESCE, NULLIF)

**Not Allowed**:
- GROUP BY / aggregations
- Window functions with PARTITION BY (except for deduplication)

**Error Examples**:
- ❌ "Cannot assign Silver layer: Query contains aggregations. Use Gold layer for aggregated metrics"

#### Gold Layer Validation

**Allowed**:
- All Bronze and Silver features
- GROUP BY with aggregations (SUM, COUNT, AVG, MIN, MAX)
- Window functions (RANK, ROW_NUMBER, LAG, LEAD)
- Complex analytical calculations
- CTEs for staged computations
- Business logic metrics

**Not Allowed**:
- (No restrictions - Gold supports all query features)

**Warnings**:
- ⚠️ "Gold layer recommended: Query contains aggregations with GROUP BY"

---

### Health Check Integration

Layer classification enhances data model health checks:

#### New Health Issue Codes

1. **`layer_unclassified`**: Model has no assigned layer
   - **Severity**: Warning
   - **Fix**: Use migration wizard or manually assign a layer

2. **`layer_validation_mismatch`**: Query structure doesn't match assigned layer
   - **Severity**: Error
   - **Fix**: Either fix the query or reassign the appropriate layer

3. **`composition_layer_progression_warning`**: Non-standard layer flow in composition
   - **Severity**: Warning
   - **Fix**: Review if the flow is intentional; adjust if needed

4. **`composition_uses_unclassified_sources`**: Composed from unclassified models
   - **Severity**: Warning
   - **Fix**: Classify source models first

#### Health Status Impact

Models with layer-related issues show **warning** or **error** status badges on the Data Models list.

#### Automated Re-Validation

When a model's query is updated:
1. The system re-validates the layer assignment
2. If validation fails, the model's health status changes to **error**
3. The health check report shows the specific validation failure

---

### Troubleshooting & FAQ

#### Q: Why does my query validation fail?

**A**: The query structure doesn't match the selected layer's rules. Common issues:

- **Bronze with JOIN**: Bronze is for raw, single-source data only → Use Silver
- **Silver with GROUP BY**: Aggregations require Gold layer → Use Gold
- **Gold without aggregations**: If there's no GROUP BY or complex logic, it might be Silver

Check the validation rules reference above to see what's allowed per layer.

---

#### Q: Can I change a model's layer after creation?

**A**: Yes! Edit the model, change the layer dropdown, and save. The system will re-validate the query structure. If validation fails, you'll need to either:
- Adjust the query to match the new layer
- Choose a different layer that matches your query

---

#### Q: What if I disagree with the AI recommendation?

**A**: You're not required to use the recommendation. The AI provides guidance based on query patterns, but you have final control. If you believe a different layer is more appropriate for your use case, select it manually.

However, if validation fails when you choose a different layer, the query structure objectively doesn't match that layer's requirements.

---

#### Q: How do I fix "layer_validation_mismatch" errors?

**A**: This error means your query structure doesn't match the assigned layer. To fix:

1. **Check the health check details** to see the exact reason
2. **Review the validation rules** for your assigned layer
3. **Choose one**:
   - **Option A**: Edit the query to match the layer (e.g., remove joins from Bronze)
   - **Option B**: Reassign the model to the correct layer (e.g., change Bronze to Silver if it has joins)

---

#### Q: Should I classify existing models all at once?

**A**: Use the **Migration Wizard** to handle bulk classification efficiently:

1. Review AI recommendations in the wizard
2. Check confidence levels (High = safer, Medium = review carefully)
3. Click info icons to understand reasoning
4. Apply classifications in bulk

Classifying one-by-one is tedious and error-prone for large projects.

---

#### Q: What happens if I compose Bronze from Gold?

**A**: The system allows it but shows a **flow warning**. This is valid in rare cases (e.g., exporting refined data back to a raw format), but usually indicates a mistake.

Standard flows:
- Bronze → Silver → Gold (progressive refinement)
- Gold → Gold (metric refinement)
- Silver → Gold (skip Bronze if data is already clean)

---

#### Q: Can I have models without layers?

**A**: Yes, but it's not recommended. Unclassified models:
- Trigger health warnings (`layer_unclassified`)
- Don't appear in layer-filtered views
- Won't receive composition recommendations
- Make data architecture less clear

Use the migration wizard to classify all models.

---

#### Q: Do I need to assign layers to source tables?

**A**: No. Layers apply only to **data models**, not source tables. Source tables are considered raw by default.

---

#### Q: How does layer assignment affect performance?

**A**: Layer assignment itself doesn't impact query performance—it's purely metadata. However:

- **Proper layering** (Bronze → Silver → Gold) often **improves** performance because:
  - Bronze models materialize raw data once
  - Silver models pre-compute joins and cleaning
  - Gold models pre-aggregate metrics
- **Composing from materialized layers** is faster than re-computing from raw tables

---

#### Q: Can I mix layers in a single composition?

**A**: Yes! You can compose from multiple models with different layers. The system will:

1. Detect all source model layers
2. Recommend the **highest layer + 1** (or highest if already at Gold)
3. Show a flow warning if the mix is non-standard

Example: Composing from Bronze + Silver sources → Recommended: Silver (you're cleaning the Bronze data)

---

### Migration Checklist for Existing Projects

If you have an existing project with unclassified models, follow this checklist:

- [ ] **Step 1**: Review the layer definitions (Bronze/Silver/Gold) in this guide
- [ ] **Step 2**: Open the Data Models list in your project
- [ ] **Step 3**: Look for the amber "Classify Your Data Models" banner
- [ ] **Step 4**: Click "Open Migration Wizard"
- [ ] **Step 5**: Review AI recommendations for each model
- [ ] **Step 6**: Click info icons (ℹ️) to understand reasoning
- [ ] **Step 7**: Adjust selections if you disagree with recommendations
- [ ] **Step 8**: Click "Apply Layer Classifications"
- [ ] **Step 9**: Verify badges appear on classified models
- [ ] **Step 10**: Check health status to ensure no validation errors
- [ ] **Step 11**: Update dependent compositions if needed

---

## AI Data Modeler Integration

The AI Data Modeler feature now **automatically recommends existing data models** when building new models.

### How It Works

When you open the AI Data Modeler:
1. The AI is initialized with:
   - Your source table schema
   - **All existing data models in the project** (Issue #361 - Issue #8)
2. The AI can recommend:
   - Building from raw tables (traditional approach)
   - Building from existing data models (composition approach)
   - Mixing both sources for hybrid models

### Example AI Guidance

> **AI**: I see you have an existing data model called **Customer Order History** that already joins `customers`, `orders`, and `order_items`. Instead of re-creating those joins, I recommend using that model as your base and adding aggregations on top of it for calculating average order value per customer.

The AI considers:
- Model freshness (last_refreshed_at)
- Health status (healthy, warning, stale)
- Column availability
- Performance implications

---

## Troubleshooting & FAQ

### Q: Why don't I see any data models in the sidebar?
**A**: You need to have at least one saved data model in the project. Create your first model from source tables, then subsequent models can use it as a base.

### Q: What happens if I delete a parent data model?
**A**: Child models that depend on it will become **unhealthy** because the source table no longer exists. You'll need to rebuild them from source tables or another valid parent.

### Q: Can I build a data model from multiple other data models?
**A**: Yes! You can mix columns from multiple data models (and source tables) in a single query, just like joining multiple source tables.

### Q: How do I know if a model is compositional?
**A**: Check the `uses_data_models` flag in the model metadata, or look for columns starting with `data_model_` in the query definition.

### Q: Does composition affect performance?
**A**: Generally **improves** performance! Data models are pre-computed and materialized, so querying them is faster than re-computing from raw tables.

### Q: What if I refresh a parent model with new columns?
**A**: The child model won't automatically inherit new columns. You need to **manually rebuild** the child and select the new columns.

### Q: Can I edit a compositional model's query?
**A**: Yes, but be aware:
- Removing parent model columns will break the lineage
- The staleness tracking will reset when you rebuild

### Q: Why does the staleness warning persist after rebuilding?
**A**: Refresh the page or re-open the model. The system checks staleness on model load.

---

## Technical Architecture Summary

### Backend Components

**Database Tables**:
- `dra_data_models`: Stores model definitions (added `uses_data_models` boolean)
- `dra_data_model_lineage`: Tracks parent-child relationships (child_data_model_id, parent_data_model_id)

**Processor Methods** (DataModelProcessor):
- `detectDataModelLineage()`: Auto-detects dependencies by parsing queryJSON
- `checkDataModelStaleness()`: Compares refresh timestamps
- `getDataModelsAsSourceTables()`: Formats models as selectable sources
- `detectCircularDependency()`: BFS traversal to prevent infinite loops

**API Endpoints**:
- `GET /data-model/project/:projectId/data-models-as-tables`: Returns all models as source table format
- `GET /data-model/staleness/:dataModelId`: Checks if model is stale

### Frontend Components

**Pinia Store** (data_models.ts):
- `dataModelSourceTables`: Ref array of models in source table format
- `retrieveDataModelsAsSourceTables()`: Fetches from API
- `setDataModelSourceTables()`: Stores with localStorage sync

**Middleware** (02-load-data.global.ts):
- Pre-loads data models as tables on `dataModels:metadata` route

**UI Components** (data-model-builder.vue):
- Two collapsible sidebar sections (Data Sources + Data Models)
- Staleness warning banner with "Rebuild This Model Now" action
- Visual differentiation via purple/pink gradient for data models

### AI Integration

**AIDataModelerController** (`initializeSession`):
- Fetches existing data models for the project
- Appends markdown section "## Existing Data Models"
- Includes model metadata (type, health, row count, columns)
- Guides AI to recommend compositional strategies

---

## Migration Guide

### Upgrading Existing Models

Existing models (created before this feature) will continue to work without changes. They are automatically treated as:
- **Base models** (not compositional, `uses_data_models = false`)
- Available as sources for new compositional models

No manual migration required.

### Database Migration

Run the migration to add the new schema:

```bash
cd backend
npm run migration:run
```

This creates:
- `dra_data_model_lineage` table
- `uses_data_models` column on `dra_data_models`

---

## Future Enhancements (Planned)

- **Automatic Cascade Refresh**: When a parent model is refreshed, optionally auto-refresh children
- **Visual Lineage Graph**: Interactive diagram showing model dependencies
- **Version History**: Track changes to compositional models over time
- **Template Models**: Save common compositional patterns as reusable templates

---

## Support & Feedback

For questions, issues, or feature requests related to Data Model Composition:

- Submit a GitHub issue: [GitHub Issues](https://github.com/Data-Research-Analysis/data-research-analysis-platform/issues)
- Tag with: `feature: data-model-composition`

---

**Last Updated**: January 2025  
**Feature Version**: 2.0.0 (Issue #361 - Medallion Architecture)  
**Related Documentation**:
- [AI Data Modeler Implementation](./ai-data-modeler-implementation.md)
- [Data Model Health Enforcement](./data-model-health-enforcement-implementation.md)
- [Data Model Medallion Architecture Implementation](./data-model-medallion-architecture-implementation.md)
- [Comprehensive Architecture Documentation](./comprehensive-architecture-documentation.md)

**New in Version 2.0.0**:
- ✨ **Medallion Architecture**: Bronze/Silver/Gold layer classification system
- ✨ **AI-Powered Validation**: Automatic layer recommendations based on query structure
- ✨ **Migration Wizard**: Bulk classification tool for existing models
- ✨ **Composition Intelligence**: Real-time layer recommendations during model building
- ✨ **Flow Warnings**: Alerts for non-standard layer progression patterns
- ✨ **Health Integration**: Layer-related health checks and validation
