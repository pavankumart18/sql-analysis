"""
Generate an interactive web page for SQL query analysis visualization.
Similar to SandDance interface with filtering, selection, and multiple chart types.
"""

import json
import pandas as pd
from collections import Counter

# Load execution log
print("Loading execution log...")
executions = []
with open('execution_log.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        executions.append(json.loads(line.strip()))

print(f"Loaded {len(executions)} execution records")

# Aggregate data per sql_id
sql_id_data = {}

for exec_record in executions:
    sql_id = exec_record['sql_id']
    
    if sql_id not in sql_id_data:
        sql_id_data[sql_id] = {
            'execution_count': 0,
            'tables': set(),
            'kpis': set(),
            'archetype': exec_record.get('archetype', 'unknown'),
            'analyst': exec_record.get('analyst', 'unknown'),
            'execution_dates': []
        }
    
    sql_id_data[sql_id]['execution_count'] += 1
    
    if 'expected_sources' in exec_record:
        sql_id_data[sql_id]['tables'].update(exec_record['expected_sources'])
    
    if 'expected_kpis' in exec_record:
        kpi_names = [kpi.get('name', '') for kpi in exec_record['expected_kpis']]
        sql_id_data[sql_id]['kpis'].update(kpi_names)
    
    if 'created_ts' in exec_record:
        try:
            from datetime import datetime
            dt = datetime.strptime(exec_record['created_ts'], '%Y-%m-%d %H:%M:%S')
            sql_id_data[sql_id]['execution_dates'].append(dt)
        except:
            pass

print(f"Found {len(sql_id_data)} unique sql_ids")

# Convert to list of dictionaries for JSON export
data_rows = []
for sql_id, data in sql_id_data.items():
    count = data['execution_count']
    if count >= 30:
        freq_bucket = 'daily'
    elif count >= 4:
        freq_bucket = 'weekly'
    elif count >= 2:
        freq_bucket = 'monthly'
    else:
        freq_bucket = 'ad-hoc'
    
    data_rows.append({
        'sql_id': sql_id,
        'num_tables': len(data['tables']),
        'num_kpis': len(data['kpis']),
        'execution_frequency': data['execution_count'],
        'archetype': data['archetype'],
        'analyst': data['analyst'],
        'tables_used': sorted(list(data['tables'])),
        'kpis_used': sorted(list(data['kpis'])),
        'frequency_bucket': freq_bucket
    })

# Get unique values for filters
archetypes = sorted(set(d['archetype'] for d in data_rows))
analysts = sorted(set(d['analyst'] for d in data_rows))
frequency_buckets = sorted(set(d['frequency_bucket'] for d in data_rows))

print(f"\nData Summary:")
print(f"Total unique sql_ids: {len(data_rows)}")
print(f"Archetypes: {len(archetypes)}")
print(f"Analysts: {len(analysts)}")

# Generate HTML with embedded data and JavaScript
html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL Query Analysis Dashboard</title>
    <script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            height: 100vh;
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        
        .header h1 {{
            font-size: 20px;
            font-weight: 600;
        }}
        
        .header-controls {{
            display: flex;
            gap: 10px;
        }}
        
        .btn {{
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }}
        
        .btn:hover {{
            background: rgba(255,255,255,0.3);
        }}
        
        .btn.active {{
            background: rgba(255,255,255,0.4);
        }}
        
        .container {{
            display: flex;
            height: calc(100vh - 50px);
        }}
        
        .sidebar {{
            width: 300px;
            background: white;
            border-right: 1px solid #e0e0e0;
            padding: 20px;
            overflow-y: auto;
            box-shadow: 2px 0 4px rgba(0,0,0,0.05);
        }}
        
        .sidebar-section {{
            margin-bottom: 25px;
        }}
        
        .sidebar-section h3 {{
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .data-info {{
            background: #f8f9fa;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 15px;
        }}
        
        .data-info .total {{
            font-size: 24px;
            font-weight: 600;
            color: #667eea;
        }}
        
        .data-info .filtered {{
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }}
        
        .filter-group {{
            margin-bottom: 15px;
        }}
        
        .filter-group label {{
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 6px;
            font-weight: 500;
        }}
        
        .filter-group select, .filter-group input {{
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
        }}
        
        .filter-group select:focus, .filter-group input:focus {{
            outline: none;
            border-color: #667eea;
        }}
        
        .chart-type {{
            display: flex;
            flex-direction: column;
            gap: 8px;
        }}
        
        .chart-type-option {{
            display: flex;
            align-items: center;
            padding: 8px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }}
        
        .chart-type-option:hover {{
            background: #f8f9fa;
            border-color: #667eea;
        }}
        
        .chart-type-option input[type="radio"] {{
            margin-right: 8px;
        }}
        
        .chart-type-option label {{
            cursor: pointer;
            font-size: 13px;
            flex: 1;
        }}
        
        .column-mapping {{
            display: flex;
            flex-direction: column;
            gap: 10px;
        }}
        
        .mapping-item {{
            display: flex;
            flex-direction: column;
            gap: 4px;
        }}
        
        .mapping-item label {{
            font-size: 11px;
            color: #666;
            font-weight: 500;
        }}
        
        .mapping-item select {{
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
        }}
        
        .visualization-area {{
            flex: 1;
            background: white;
            position: relative;
            overflow: hidden;
        }}
        
        #plotly-chart {{
            width: 100%;
            height: 100%;
        }}
        
        .tooltip {{
            position: absolute;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            max-width: 300px;
            display: none;
        }}
        
        .tooltip.show {{
            display: block;
        }}
        
        .tooltip h4 {{
            margin-bottom: 8px;
            font-size: 13px;
            border-bottom: 1px solid rgba(255,255,255,0.3);
            padding-bottom: 4px;
        }}
        
        .tooltip p {{
            margin: 4px 0;
            font-size: 11px;
        }}
        
        .tooltip .label {{
            color: #aaa;
            margin-right: 6px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>SQL Query Analysis Dashboard</h1>
        <div class="header-controls">
            <button class="btn" onclick="clearSelection()">Clear Selection</button>
            <button class="btn" onclick="isolateSelection()">Isolate</button>
            <button class="btn" onclick="resetFilters()">Reset Filters</button>
            <button class="btn" id="darkModeBtn" onclick="toggleDarkMode()">Dark</button>
        </div>
    </div>
    
    <div class="container">
        <div class="sidebar">
            <div class="sidebar-section">
                <div class="data-info">
                    <div class="total" id="totalCount">{len(data_rows)}</div>
                    <div class="filtered">Total Queries Analyzed</div>
                    <div class="filtered" id="filteredCount" style="margin-top: 8px;">0 filtered, 0 selected</div>
                </div>
            </div>
            
            <div class="sidebar-section">
                <h3>Chart Type</h3>
                <div class="chart-type">
                    <div class="chart-type-option">
                        <input type="radio" name="chartType" value="scatter" id="scatter" checked onchange="updateChartType()">
                        <label for="scatter">Scatter</label>
                    </div>
                    <div class="chart-type-option">
                        <input type="radio" name="chartType" value="grid" id="grid" onchange="updateChartType()">
                        <label for="grid">Grid</label>
                    </div>
                    <div class="chart-type-option">
                        <input type="radio" name="chartType" value="bar" id="bar" onchange="updateChartType()">
                        <label for="bar">Bar</label>
                    </div>
                </div>
            </div>
            
            <div class="sidebar-section">
                <h3>Column Mapping</h3>
                <div class="column-mapping">
                    <div class="mapping-item">
                        <label>X Axis</label>
                        <select id="xAxis" onchange="updateVisualization()">
                            <option value="num_tables" selected>Number of Tables</option>
                            <option value="num_kpis">Number of KPIs</option>
                            <option value="execution_frequency">Execution Frequency</option>
                        </select>
                    </div>
                    <div class="mapping-item">
                        <label>Y Axis</label>
                        <select id="yAxis" onchange="updateVisualization()">
                            <option value="execution_frequency" selected>Execution Frequency</option>
                            <option value="num_tables">Number of Tables</option>
                            <option value="num_kpis">Number of KPIs</option>
                        </select>
                    </div>
                    <div class="mapping-item">
                        <label>Color By</label>
                        <select id="colorBy" onchange="updateVisualization()">
                            <option value="archetype" selected>Archetype</option>
                            <option value="frequency_bucket">Frequency Bucket</option>
                            <option value="analyst">Analyst</option>
                        </select>
                    </div>
                    <div class="mapping-item">
                        <label>Size By</label>
                        <select id="sizeBy" onchange="updateVisualization()">
                            <option value="none">-- none --</option>
                            <option value="num_kpis">Number of KPIs</option>
                            <option value="num_tables">Number of Tables</option>
                            <option value="execution_frequency">Execution Frequency</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="sidebar-section">
                <h3>Filters</h3>
                <div class="filter-group">
                    <label>Archetype</label>
                    <select id="filterArchetype" multiple size="5" onchange="applyFilters()">
                        {''.join(f'<option value="{arch}" selected>{arch}</option>' for arch in archetypes)}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Frequency Bucket</label>
                    <select id="filterFrequency" multiple size="4" onchange="applyFilters()">
                        {''.join(f'<option value="{fb}" selected>{fb}</option>' for fb in frequency_buckets)}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Min Tables</label>
                    <input type="number" id="minTables" min="0" max="10" value="0" onchange="applyFilters()">
                </div>
                <div class="filter-group">
                    <label>Max Tables</label>
                    <input type="number" id="maxTables" min="0" max="10" value="10" onchange="applyFilters()">
                </div>
            </div>
        </div>
        
        <div class="visualization-area">
            <div id="plotly-chart"></div>
            <div class="tooltip" id="tooltip"></div>
        </div>
    </div>
    
    <script>
        // Embedded data
        const allData = {json.dumps(data_rows, indent=8)};
        let filteredData = [...allData];
        let selectedPoints = [];
        let currentChartType = 'scatter';
        
        // Initialize
        updateVisualization();
        
        function updateVisualization() {{
            const xAxis = document.getElementById('xAxis').value;
            const yAxis = document.getElementById('yAxis').value;
            const colorBy = document.getElementById('colorBy').value;
            const sizeBy = document.getElementById('sizeBy').value;
            
            const xData = filteredData.map(d => d[xAxis]);
            const yData = filteredData.map(d => d[yAxis]);
            const colorData = filteredData.map(d => d[colorBy]);
            const sizeData = sizeBy !== 'none' ? filteredData.map(d => d[sizeBy]) : null;
            
            const hoverText = filteredData.map(d => {{
                const tables = Array.isArray(d.tables_used) ? d.tables_used.join(', ') : d.tables_used;
                const kpis = Array.isArray(d.kpis_used) ? d.kpis_used.join(', ') : d.kpis_used;
                return '<b>' + d.sql_id + '</b><br>' +
                       'Tables: ' + tables + '<br>' +
                       'KPIs: ' + kpis + '<br>' +
                       'Frequency: ' + d.frequency_bucket + '<br>' +
                       'Tables: ' + d.num_tables + ', KPIs: ' + d.num_kpis;
            }});
            
            let trace;
            
            if (currentChartType === 'scatter') {{
                trace = {{
                    x: xData,
                    y: yData,
                    mode: 'markers',
                    type: 'scatter',
                    marker: {{
                        color: colorData,
                        colorscale: 'Viridis',
                        size: sizeData ? sizeData.map(s => Math.max(5, s * 3)) : 8,
                        showscale: true,
                        colorbar: {{ title: colorBy }}
                    }},
                    text: filteredData.map(d => d.sql_id),
                    customdata: filteredData.map((d, i) => i),
                    hovertemplate: hoverText.map((h, i) => h + '<extra></extra>')
                }};
            }} else if (currentChartType === 'grid') {{
                // Grid layout: arrange points in a grid
                const gridSize = Math.ceil(Math.sqrt(filteredData.length));
                const xGrid = [];
                const yGrid = [];
                
                filteredData.forEach((d, i) => {{
                    xGrid.push(i % gridSize);
                    yGrid.push(Math.floor(i / gridSize));
                }});
                
                trace = {{
                    x: xGrid,
                    y: yGrid,
                    mode: 'markers',
                    type: 'scatter',
                    marker: {{
                        color: colorData,
                        colorscale: 'Viridis',
                        size: sizeData ? sizeData.map(s => Math.max(8, s * 4)) : 10,
                        showscale: true,
                        colorbar: {{ title: colorBy }}
                    }},
                    text: filteredData.map(d => d.sql_id),
                    customdata: filteredData.map((d, i) => i),
                    hovertemplate: hoverText.map((h, i) => h + '<extra></extra>')
                }};
            }} else if (currentChartType === 'bar') {{
                // Bar chart: group by colorBy and count
                const grouped = {{}};
                filteredData.forEach(d => {{
                    const key = d[colorBy];
                    if (!grouped[key]) grouped[key] = 0;
                    grouped[key]++;
                }});
                
                trace = {{
                    x: Object.keys(grouped),
                    y: Object.values(grouped),
                    type: 'bar',
                    marker: {{
                        color: Object.keys(grouped),
                        colorscale: 'Viridis'
                    }}
                }};
            }}
            
            function formatTitle(str) {{
                return str.replace(/_/g, ' ').split(' ').map(w => 
                    w.charAt(0).toUpperCase() + w.slice(1)
                ).join(' ');
            }}
            
            const layout = {{
                title: 'SQL Query Analysis: ' + filteredData.length + ' Queries',
                xaxis: {{ title: formatTitle(xAxis) }},
                yaxis: {{ title: formatTitle(yAxis) }},
                hovermode: 'closest',
                height: window.innerHeight - 50,
                margin: {{ l: 60, r: 20, t: 60, b: 60 }}
            }};
            
            const plotDiv = document.getElementById('plotly-chart');
            Plotly.newPlot(plotDiv, [trace], layout, {{ responsive: true }});
            
            // Add click handler for selection
            plotDiv.on('plotly_click', function(data) {{
                if (data.points && data.points.length > 0) {{
                    const pointIndex = data.points[0].customdata;
                    
                    if (selectedPoints.includes(pointIndex)) {{
                        selectedPoints = selectedPoints.filter(i => i !== pointIndex);
                    }} else {{
                        selectedPoints.push(pointIndex);
                    }}
                    
                    updateSelection();
                }}
            }});
            
            updateFilteredCount();
        }}
        
        function updateChartType() {{
            const radios = document.querySelectorAll('input[name="chartType"]');
            radios.forEach(radio => {{
                if (radio.checked) {{
                    currentChartType = radio.value;
                    updateVisualization();
                }}
            }});
        }}
        
        function applyFilters() {{
            const archetypeFilter = Array.from(document.getElementById('filterArchetype').selectedOptions).map(o => o.value);
            const frequencyFilter = Array.from(document.getElementById('filterFrequency').selectedOptions).map(o => o.value);
            const minTables = parseInt(document.getElementById('minTables').value) || 0;
            const maxTables = parseInt(document.getElementById('maxTables').value) || 100;
            
            filteredData = allData.filter(d => {{
                return archetypeFilter.includes(d.archetype) &&
                       frequencyFilter.includes(d.frequency_bucket) &&
                       d.num_tables >= minTables &&
                       d.num_tables <= maxTables;
            }});
            
            selectedPoints = [];
            updateVisualization();
        }}
        
        function clearSelection() {{
            selectedPoints = [];
            updateSelection();
        }}
        
        function isolateSelection() {{
            if (selectedPoints.length > 0) {{
                filteredData = selectedPoints.map(i => filteredData[i]);
                selectedPoints = [];
                updateVisualization();
            }}
        }}
        
        function resetFilters() {{
            document.getElementById('filterArchetype').selectedIndex = -1;
            Array.from(document.getElementById('filterArchetype').options).forEach(opt => opt.selected = true);
            document.getElementById('filterFrequency').selectedIndex = -1;
            Array.from(document.getElementById('filterFrequency').options).forEach(opt => opt.selected = true);
            document.getElementById('minTables').value = 0;
            document.getElementById('maxTables').value = 10;
            filteredData = [...allData];
            selectedPoints = [];
            updateVisualization();
        }}
        
        function updateSelection() {{
            // Highlight selected points
            updateFilteredCount();
        }}
        
        function updateFilteredCount() {{
            const total = allData.length;
            const filtered = filteredData.length;
            const selected = selectedPoints.length;
            document.getElementById('filteredCount').textContent = 
                filtered + ' shown, ' + selected + ' selected';
        }}
        
        function toggleDarkMode() {{
            document.body.classList.toggle('dark-mode');
            const btn = document.getElementById('darkModeBtn');
            btn.textContent = document.body.classList.contains('dark-mode') ? 'Light' : 'Dark';
        }}
    </script>
</body>
</html>
"""

# Write HTML file
output_file = 'query_analysis_dashboard.html'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"\nInteractive dashboard saved to: {output_file}")
print(f"Open {output_file} in a web browser to view the interactive dashboard.")

