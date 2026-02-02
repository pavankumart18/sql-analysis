# Section B: SQL Workload Analysis Process

## Overview

This section explains HOW a large SQL workload is analyzed to produce insights and a middle layer. The process transforms raw SQL queries into structured, actionable patterns through six systematic stages.

---

## Stage 1: SQL Workload Ingestion

### What Goes In
- Raw SQL query logs from production systems
- Execution history with timestamps
- Query metadata (analyst, context, etc.)

### What Comes Out
- Normalized query collection with stable identifiers
- Execution timeline showing when queries run
- Query identifiers (sql_id) that persist through analysis

### Why This Matters
Ingestion establishes the foundation by collecting all SQL activity into a unified, queryable format. Each query receives a stable identifier (sql_id) that persists through the entire analysis pipeline, ensuring traceability from raw SQL to final insights.

### Example Artifacts
- **sql.json** - Collection of 1,500 unique SQL queries with stable IDs
- **execution_log.jsonl** - Chronological execution history with metadata

---

## Stage 2: Parsing & Normalization

### What Goes In
- Raw SQL text with variations
- Inconsistent formatting and aliases
- Query variations that are semantically equivalent

### What Comes Out
- Structured query representation
- Normalized table references (handling aliases)
- Extracted KPI expressions in standardized form

### Why This Matters
Parsing transforms unstructured SQL text into a structured representation that enables systematic analysis. Normalization handles variations (different table aliases, formatting differences) so that semantically equivalent queries are recognized as such, revealing true patterns rather than surface-level differences.

### Example Artifacts
- **Normalized query structure** - Each query parsed into:
  - `expected_sources` (tables used)
  - `expected_kpis` (metrics calculated)
  - `archetype` (query pattern classification)

---

## Stage 3: Feature Extraction

### What Goes In
- Structured query data from parsing
- Execution metadata
- Query patterns and relationships

### What Comes Out
- **Quantitative features**: num_tables_used, num_kpis, execution_count
- **Categorical features**: primary_table, kpi_family, frequency_bucket
- **Temporal features**: dominant_hour, dominant_day_of_week
- **Relational features**: analyst, archetype

### Why This Matters
Feature extraction converts parsed SQL into analyzable dimensions. These features become the building blocks for pattern discovery—quantitative measures (like complexity) and categorical groupings (like KPI families) that reveal how queries cluster and relate to each other.

### Example Artifacts
- **sql_universe.csv** - Flat file with one row per sql_id containing:
  - num_tables_used, num_kpis
  - primary_table, kpi_family
  - execution_count, frequency_bucket
  - analyst, dominant_hour, dominant_day_of_week

---

## Stage 4: Workload Analysis

### What Goes In
- Extracted features for all queries
- Execution patterns and frequencies
- Usage metadata

### What Comes Out
- **Usage-weighted statistics**: Which tables/KPIs appear most frequently
- **Frequency distributions**: How queries are distributed across patterns
- **Analyst activity patterns**: Who uses what, when
- **Temporal usage patterns**: Hourly and daily usage trends

### Why This Matters
Workload analysis applies statistical methods to reveal usage-weighted patterns. Rather than treating all queries equally, this stage identifies which tables, KPIs, and patterns are most critical based on actual execution frequency. This prioritization guides where to focus optimization and standardization efforts.

### Example Artifacts
- **csv/table_usage.csv** - Shows raw_ticket_sales used in 835 queries (most common)
- **csv/kpi_alias_usage.csv** - Shows "tickets_sold" appears in 629 queries
- **csv/analyst_activity.csv** - Usage patterns by analyst and time
- **csv/hourly_activity.csv** - Peak usage times
- **csv/day_of_week_activity.csv** - Weekly patterns

---

## Stage 5: Pattern Discovery

### What Goes In
- Usage statistics from workload analysis
- Feature distributions
- Query relationships and similarities

### What Comes Out
- **Query archetypes**: 9 distinct patterns identified:
  - ticket_revenue_daily (530 queries)
  - attendance_rate (251 queries)
  - campaign_funnel (219 queries)
  - refund_spike (119 queries)
  - attach_rate (99 queries)
  - support_sla (96 queries)
  - marketing_last_touch (81 queries)
  - deals_pipeline (66 queries)
  - rfm_segmentation (39 queries)
- **KPI expression reuse patterns**: Common expressions identified
- **Table combination patterns**: Which tables are used together
- **Frequency-based classifications**: daily/weekly/monthly/ad-hoc buckets

### Why This Matters
Pattern discovery identifies recurring structures that emerge naturally from the data. These patterns—like "ticket_revenue_daily" appearing in 530 queries—reveal the true taxonomy of the workload. Patterns are derived analytically from usage-weighted analysis, not manually defined, ensuring they reflect actual business needs.

### Example Artifacts
- **Archetype classification** - 9 distinct query patterns covering 1,500 queries
- **csv/kpi_expression_reuse.csv** - Shows "COUNT(DISTINCT t.ticket_id) AS tickets_sold" reused 530 times
- **Frequency buckets** - Classification of query usage patterns

---

## Stage 6: Middle Layer Synthesis

### What Goes In
- Discovered patterns from Stage 5
- Usage-weighted insights
- Query archetypes and their characteristics

### What Comes Out
- **Standardized KPI definitions**: Derived from most-used expressions
- **Reusable query templates**: Patterns for each archetype
- **Table relationship mappings**: Shows which tables are commonly used together
- **Analytical building blocks**: Components that can be reused across queries

### Why This Matters
Middle layer synthesis transforms discovered patterns into actionable, reusable components. Rather than having 1,500 ad-hoc queries, the analysis reveals that most queries follow 9 core patterns. The middle layer provides standardized definitions and templates derived from actual usage, creating a foundation for consistency and efficiency.

### Example Artifacts
- **Standardized KPI library** - Derived from most-used expressions
  - Example: "tickets_sold" standardized from 530 variations
- **Query templates** - Reusable patterns for each archetype
- **Table relationship map** - Shows common table combinations
- **Analytical building blocks** - Components for building new queries

---

## Process Flow Summary

```
SQL Queries (1,500)
    ↓
[Ingestion] → Normalized collection with sql_id
    ↓
[Parsing] → Structured representation
    ↓
[Feature Extraction] → Analyzable dimensions
    ↓
[Workload Analysis] → Usage-weighted statistics
    ↓
[Pattern Discovery] → 9 core archetypes emerge
    ↓
[Middle Layer Synthesis] → Reusable components
```

## Key Connections

### SQL → Features
Raw SQL text is parsed and normalized into structured features (table counts, KPI counts, archetypes) that enable systematic analysis.

### Features → Patterns
Statistical analysis of features reveals patterns that emerge naturally: 9 archetypes covering all 1,500 queries, with usage-weighted importance.

### Patterns → Middle Layer
Discovered patterns are synthesized into reusable components: standardized KPIs, query templates, and analytical building blocks derived analytically from actual usage.

## Methodology Principles

1. **Derived Analytically, Not Manually**: Patterns emerge from data analysis, not predefined categories
2. **Usage-Weighted**: Most-used patterns receive priority in the middle layer
3. **Structured Representation**: All queries converted to analyzable format
4. **Traceability**: Each query maintains its sql_id through all stages
5. **Comprehensive**: All 1,500 queries analyzed—nothing filtered out

---

## Visual Diagram Structure

The interactive HTML page (section_b_process.html) provides:
- **Vertical process flow** with 6 expandable stages
- **Click to expand** each stage for detailed information
- **Clear visual hierarchy** showing progression
- **Summary statistics** at the bottom

Each stage shows:
- Input/Output clearly separated
- "Why This Matters" explanation
- Example artifacts from actual analysis

