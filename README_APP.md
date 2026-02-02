
# SQL Usage Analysis - Interactive Visualization

**Enhanced Version (v2.1)**

This interactive web application visualizes 1,500+ SQL queries, their execution patterns, and the proposed semantic "Middle Layer" derived from them.

## Key Features

1.  **The Universe (Section A)**
    *   **Interactive Grid/Scatter**: Visualize all 1,500 queries as individual data points.
    *   **Smart Coloring**: Color codes by Frequency, KPI Family, or Primary Table.
    *   **Layouts**: Switch between Grid, Scatter, and Timeline views with smooth physics-based transitions.
    *   **Detailed Tooltips**: Hover over any query to see its ID, logic, and usage stats.

2.  **The Process (Section B)**
    *   **6-Stage Pipeline**: Explains how raw SQL logs are transformed into structured archetypes.
    *   **Interactive Details**: Click on any stage (Ingestion, Parsing, Synthesis, etc.) to view Inputs, Outputs, and "Why it Matters".

3.  **The Middle Layer (Section C)**
    *   **Proposed Data Model**: Explore the 2-4 key tables (Facts & Dimensions) synthesized from query clusters.
    *   **Schema Deep Dive**: View specific columns, types, and the business pain points resolved by each table.
    *   **Impact Metrics**: See the % of queries authorized/standardized by each middle layer table.

## How to Run

1.  Ensure `app_data.json` is generated (run `python build_data.py` if missing).
2.  Open `index.html` in any modern web browser.
3.  Use the top navigation bar to explore the sections.

## Technologies

*   **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism, Grid/Flexbox), JavaScript (ES6+).
*   **Data Processing**: Python (JSON Parsing, Frequency Analysis).
