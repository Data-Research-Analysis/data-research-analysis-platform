# Data Model Composition - User Guide

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
**Feature Version**: 1.0.0 (Issue #361)  
**Related Documentation**:
- [AI Data Modeler Implementation](./ai-data-modeler-implementation.md)
- [Data Model Health Enforcement](./data-model-health-enforcement-implementation.md)
- [Comprehensive Architecture Documentation](./comprehensive-architecture-documentation.md)
