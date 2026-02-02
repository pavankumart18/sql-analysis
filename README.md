# NFL SQL Usage Analysis Project

An interactive suite of tools for parsing, analyzing, and visualizing 1,500+ SQL queries to derive a high-fidelity semantic "Middle Layer" and understand workload patterns.

## 🚀 Overview

This repository contains the complete pipeline and visualization suite developed to transform raw SQL execution logs into actionable data intelligence. The project is divided into three core experiences:

1.  **The Universe**: An interactive, physics-based visualization of all 1,500+ queries.
2.  **The Process**: A step-by-step breakdown of how data is transformed from raw logs to structured metadata.
3.  **The Middle Layer**: A proposed semantic architecture based on query clustering and common access patterns.

---

## 🛠 Project Structure

### Interactive Web Application (`index.html`)
The primary entry point, providing a high-fidelity dashboard to explore the query ecosystem.
- **Section A: The Universe**:
    - **Interactive Dots**: Each point represents a unique `sql_id`.
    - **Multi-Layout Support**: Switch between Dense Grid, Grouped Facets, and Scatter Plot (Complexity vs. Frequency).
    - **Smart Color Encodings**: Heatmaps for usage frequency, KPI families, or primary source tables.
    - **Deep Dive Modals**: Click any query to see its full SQL logic, primary source table, and associated KPIs.
- **Section B: The Process**:
    - Visualizes the 6-stage transformation pipeline: Ingestion → Parsing → Sanitization → Synthesis → Classification → Mapping.
- **Section C: The Middle Layer**:
    - Proposes the final data model (Facts & Dimensions) designed to standardize 80% of the parsed workload.

### Query Analysis Dashboard (`query_analysis_dashboard.html`)
A secondary interactive dashboard focused on exploratory data analysis of the query metadata.
- **Filtering**: Slice by Archetype, Frequency, or Complexity (Table Count).
- **Encodings**: Map X/Y axes, Color, and Size to different metadata fields (KPI count, execution frequency, etc.).
- **Isolation**: Select specific query clusters to isolate and analyze.

### Data & Scripts
- `build_data.py`: The core ingestion script that processes `execution_log.jsonl` and aggregates metadata for the UI.
- `execution_log.jsonl`: The primary source of truth containing parsed execution records.
- `app_data.json` / `data.js`: The synthesized data payload used by the web application.
- `generate_interactive_webpage.py`: Generates the standalone query analysis dashboard.

---

## 🏃 How to Run

### 1. Data Preparation
If the data files (`data.js`, `app_data.json`) are missing or need updating, run the build script:
```bash
python build_data.py
```

### 2. Launching the Main Experience
Open `index.html` in any modern web browser.
- No server is required for development, though a local server (e.g., `python -m http.server`) is recommended for smoother performance.

### 3. Launching the Supplemental Dashboard
Open `query_analysis_dashboard.html` or `query_analysis_visualization.html` to view the exploratory analysis tools.

---

## 💻 Technolgies Used

- **Frontend**: Vanilla JavaScript (ES6+), D3.js (for Universe visualization), Plotly.js (for supplemental dashboard), Bootstrap 5.3 (Layout & UI components), Lucide Icons.
- **Backend/Data**: Python 3.x, Pandas (Data Manipulation), JSON-L (Log Storage).
- **Design**: Premium dark theme with glassmorphism and smooth D3 transitions.

---

## 📊 Key Metrics
- **Queries Analyzed**: 1,500+
- **Primary Archetypes**: Volume, Revenue, Efficiency, and Growth.
- **Coverage**: The proposed Middle Layer covers >85% of standard report requests.
