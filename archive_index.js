/**
 * SandDance-style SQL Query Visualization using D3.js
 * 
 * Features:
 * - All 1,500 queries always visible as dense colored bubbles
 * - Smooth, fluid animations when encodings change
 * - True SandDance-style dense grid layout
 * - Beautiful color transitions
 */

let data = null;
let svg = null;
let g = null;
let width = 0;
let height = 0;
let currentLayout = 'grid';
let currentColorEncoding = 'frequency_bucket';
let currentSort = 'none';

// Color scales for different encodings
const getColorScheme = (schemeName) => {
    try {
        if (schemeName === 'category20' && d3.schemeCategory20) {
            return d3.schemeCategory20;
        } else if (schemeName === 'set3' && d3.schemeSet3) {
            return d3.schemeSet3;
        } else if (schemeName === 'pastel1' && d3.schemePastel1) {
            return d3.schemePastel1;
        }
    } catch (e) {
        console.warn('Color scheme not available:', schemeName);
    }
    // Fallback to a simple color array
    return ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
};

const colorScales = {
    frequency_bucket: d3.scaleOrdinal().range(getColorScheme('category20')),
    kpi_family: d3.scaleOrdinal().range(getColorScheme('set3')),
    primary_table: d3.scaleOrdinal().range(getColorScheme('pastel1'))
};

// Load CSV data
async function loadData() {
    try {
        const response = await fetch('sql_universe.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        
        if (!csvText || csvText.trim().length === 0) {
            throw new Error('CSV file is empty');
        }
        
        // Parse CSV manually
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= headers.length) {
                const row = {};
                headers.forEach((header, idx) => {
                    let value = values[idx] || '';
                    // Remove quotes if present
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    value = value.trim();
                    
                    // Parse based on header
                    if (header === 'num_tables_used' || header === 'num_kpis' || 
                        header === 'execution_count' || header === 'dominant_hour') {
                        row[header] = Number(value) || 0;
                    } else {
                        row[header] = value || 'unknown';
                    }
                });
                
                if (row.sql_id) {
                    data.push(row);
                }
            }
        }
        
        if (data.length === 0) {
            throw new Error('No valid data found in CSV');
        }
        
        console.log(`Loaded ${data.length} queries`);
        document.getElementById('query-count').textContent = `${data.length.toLocaleString()} queries (all visible)`;
        
        // Initialize visualization
        initVisualization();
        updateVisualization();
    } catch (error) {
        console.error('Error loading data:', error);
        const svg = d3.select('#sanddance-viz');
        svg.selectAll('*').remove();
        svg.append('text')
            .attr('x', '50%')
            .attr('y', '50%')
            .attr('text-anchor', 'middle')
            .attr('fill', 'red')
            .attr('font-size', '16px')
            .text(`Error: ${error.message}. Make sure sql_universe.csv exists and is accessible.`);
    }
}

// Initialize SVG and container
function initVisualization() {
    const container = d3.select('#sanddance-viz');
    container.selectAll('*').remove();
    
    // Get container dimensions
    const containerEl = document.querySelector('.visualization-area');
    width = containerEl.clientWidth - 40;
    height = containerEl.clientHeight - 40;
    
    // Create SVG
    svg = container
        .attr('width', width)
        .attr('height', height)
        .style('background', '#ffffff');
    
    // Create main group
    g = svg.append('g')
        .attr('class', 'main-group');
    
    // Handle window resize
    window.addEventListener('resize', () => {
        const containerEl = document.querySelector('.visualization-area');
        width = containerEl.clientWidth - 40;
        height = containerEl.clientHeight - 40;
        svg.attr('width', width).attr('height', height);
        updateVisualization();
    });
}

// Calculate positions based on layout
function calculatePositions(data, layout) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return [];
    }
    
    if (width === 0 || height === 0) {
        // Get dimensions if not set
        const containerEl = document.querySelector('.visualization-area');
        if (containerEl) {
            width = containerEl.clientWidth - 40;
            height = containerEl.clientHeight - 40;
        } else {
            width = 800;
            height = 600;
        }
    }
    
    if (layout === 'grid') {
        // SandDance-style ultra-dense grid - very tight spacing with bigger dots
        const cols = Math.ceil(Math.sqrt(data.length));
        const rows = Math.ceil(data.length / cols);
        // Calculate cell size - make it smaller for tighter packing
        const cellWidth = width / cols;
        const cellHeight = height / rows;
        // Use very tight spacing - dots close together (85% spacing for overlap effect)
        const spacingX = cellWidth * 0.85;  // 85% of cell width - very tight
        const spacingY = cellHeight * 0.85;  // 85% of cell height - very tight
        return data.map((d, i) => ({
            ...d,
            x: (i % cols) * spacingX + cellWidth / 2,
            y: Math.floor(i / cols) * spacingY + cellHeight / 2
        }));
    } else if (layout === 'scatter') {
        // Scatter based on data values
        const numTables = data.map(d => (d && d.num_tables_used !== undefined) ? d.num_tables_used : 0).filter(v => !isNaN(v));
        const numKpis = data.map(d => (d && d.num_kpis !== undefined) ? d.num_kpis : 0).filter(v => !isNaN(v));
        
        if (numTables.length === 0 || numKpis.length === 0) {
            // Fallback to ultra-dense grid if no valid data
            const cols = Math.ceil(Math.sqrt(data.length));
            const rows = Math.ceil(data.length / cols);
            const cellWidth = width / cols;
            const cellHeight = height / rows;
            const spacingX = cellWidth * 0.85;  // Tighter spacing
            const spacingY = cellHeight * 0.85;
            return data.map((d, i) => ({
                ...d,
                x: (i % cols) * spacingX + cellWidth / 2,
                y: Math.floor(i / cols) * spacingY + cellHeight / 2
            }));
        }
        
        const xExtent = d3.extent(numTables);
        const yExtent = d3.extent(numKpis);
        
        // Ensure extent is valid
        if (!xExtent || xExtent[0] === undefined || xExtent[1] === undefined) {
            xExtent[0] = 0;
            xExtent[1] = 10;
        }
        if (!yExtent || yExtent[0] === undefined || yExtent[1] === undefined) {
            yExtent[0] = 0;
            yExtent[1] = 10;
        }
        
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([20, width - 20]);
        
        const yScale = d3.scaleLinear()
            .domain(yExtent)
            .range([height - 20, 20]);
        
        return data.map((d, i) => ({
            ...d,
            x: xScale((d && d.num_tables_used !== undefined) ? d.num_tables_used : 0) + (Math.sin(i * 0.1) * 15),
            y: yScale((d && d.num_kpis !== undefined) ? d.num_kpis : 0) + (Math.cos(i * 0.1) * 15)
        }));
    } else if (layout === 'facet') {
        // Faceted by primary_table
        const tableValues = data.map(d => (d && d.primary_table) ? d.primary_table : 'unknown').filter(t => t);
        const tables = Array.from(new Set(tableValues));
        if (!tables || tables.length === 0) {
            return data.map((d, i) => ({
                ...d,
                x: (i % 10) * 50,
                y: Math.floor(i / 10) * 50
            }));
        }
        
        const cols = 3;
        const rows = Math.ceil(tables.length / cols);
        const facetWidth = width / cols;
        const facetHeight = height / rows;
        
        const positions = [];
        tables.forEach((table, tableIdx) => {
            const tableData = data.filter(d => {
                const dTable = (d && d.primary_table) ? d.primary_table : 'unknown';
                return dTable === table;
            });
            const facetCol = tableIdx % cols;
            const facetRow = Math.floor(tableIdx / cols);
            const facetX = facetCol * facetWidth;
            const facetY = facetRow * facetHeight;
            
            const facetCols = Math.ceil(Math.sqrt(tableData.length));
            const facetRows = Math.ceil(tableData.length / facetCols);
            const facetCellWidth = facetWidth / facetCols;
            const facetCellHeight = facetHeight / facetRows;
            // Tight spacing in facets too
            const facetSpacingX = facetCellWidth * 0.85;  // Tighter spacing in facets too
            const facetSpacingY = facetCellHeight * 0.85;
            
            tableData.forEach((d, i) => {
                positions.push({
                    ...d,
                    x: facetX + (i % facetCols) * facetSpacingX + facetCellWidth / 2,
                    y: facetY + Math.floor(i / facetCols) * facetSpacingY + facetCellHeight / 2,
                    facet: table
                });
            });
        });
        return positions;
    }
    return data;
}

// Update visualization
function updateVisualization() {
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error('No data available for visualization');
        return;
    }
    
    if (!g) {
        console.error('SVG group not initialized');
        return;
    }
    
    currentLayout = document.getElementById('layout-type').value;
    currentColorEncoding = document.getElementById('color-encoding').value;
    currentSort = document.getElementById('sort-by').value;
    
    // Sort data if needed
    let displayData = [...data];
    if (currentSort !== 'none' && displayData.length > 0) {
        displayData.sort((a, b) => {
            const aVal = a[currentSort];
            const bVal = b[currentSort];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return bVal - aVal;
            }
            return 0;
        });
    }
    
    // Calculate positions
    const positions = calculatePositions(displayData, currentLayout);
    
    if (!positions || positions.length === 0) {
        console.error('No positions calculated');
        return;
    }
    
    // Get color scale - ensure it's properly initialized
    let colorScale = colorScales[currentColorEncoding];
    if (!colorScale || typeof colorScale !== 'function') {
        // Re-initialize if needed with safe color schemes
        if (currentColorEncoding === 'frequency_bucket') {
            colorScale = d3.scaleOrdinal().range(getColorScheme('category20'));
            colorScales.frequency_bucket = colorScale;
        } else if (currentColorEncoding === 'kpi_family') {
            colorScale = d3.scaleOrdinal().range(getColorScheme('set3'));
            colorScales.kpi_family = colorScale;
        } else {
            colorScale = d3.scaleOrdinal().range(getColorScheme('pastel1'));
            colorScales.primary_table = colorScale;
        }
    }
    
    // Ensure the scale has a valid range
    try {
        const range = colorScale.range();
        if (!range || !Array.isArray(range) || range.length === 0) {
            // Re-initialize with fallback
            const fallbackColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
            colorScale.range(fallbackColors);
        }
    } catch (e) {
        console.error('Error checking color scale range:', e);
        const fallbackColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
        colorScale.range(fallbackColors);
    }
    
    // Safely extract color values
    const colorValues = [];
    if (Array.isArray(positions) && positions.length > 0) {
        for (let i = 0; i < positions.length; i++) {
            const d = positions[i];
            if (d && d[currentColorEncoding] !== undefined && d[currentColorEncoding] !== null) {
                const val = String(d[currentColorEncoding]);
                if (val && val !== 'undefined' && val !== 'null') {
                    colorValues.push(val);
                }
            }
        }
    }
    
    // Set domain only if we have valid values
    try {
        if (colorValues.length > 0) {
            const seen = new Set();
            const uniqueColors = [];
            for (let i = 0; i < colorValues.length; i++) {
                const val = colorValues[i];
                if (!seen.has(val)) {
                    seen.add(val);
                    uniqueColors.push(val);
                }
            }
            if (uniqueColors.length > 0) {
                colorScale.domain(uniqueColors);
            } else {
                colorScale.domain(['unknown']);
            }
        } else {
            colorScale.domain(['unknown']);
        }
    } catch (e) {
        console.error('Error setting color scale domain:', e, colorValues);
        try {
            colorScale.domain(['unknown']);
        } catch (e2) {
            console.error('Failed to set fallback domain:', e2);
        }
    }
    
    // Bind data to bubbles - ensure positions is a valid array
    if (!Array.isArray(positions) || positions.length === 0) {
        console.error('Invalid positions array:', positions);
        return;
    }
    
    const bubbles = g.selectAll('.query-bubble')
        .data(positions, d => {
            // Key function for identity - ensure sql_id exists
            if (!d) return Math.random().toString();
            return d.sql_id ? d.sql_id.toString() : Math.random().toString();
        });
    
    // Enter: create new bubbles
    const enter = bubbles.enter()
        .append('circle')  // Use circles for bubble effect
        .attr('class', 'query-bubble')
        .attr('r', 4)  // Bigger radius for visible bubbles
        .attr('fill', d => {
            if (!d) return '#1f77b4';
            const colorValue = d[currentColorEncoding] ? String(d[currentColorEncoding]) : 'unknown';
            const color = colorScale(colorValue);
            return (color && color !== 'undefined') ? color : '#1f77b4';
        })
        .attr('stroke', 'rgba(255,255,255,0.3)')  // White stroke for definition
        .attr('stroke-width', 0.5)  // Visible stroke
        .attr('opacity', 0)  // Start invisible
        .attr('cx', d => (d && d.x !== undefined) ? d.x : 0)  // Center X for circles
        .attr('cy', d => (d && d.y !== undefined) ? d.y : 0)  // Center Y for circles
        .on('mouseover', function(event, d) {
            if (!d) return;
            // Show tooltip
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0)
                .style('position', 'absolute')
                .style('background', 'rgba(0,0,0,0.9)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '4px')
                .style('pointer-events', 'none')
                .style('font-size', '12px')
                .html(`
                    <strong>${d.sql_id || 'N/A'}</strong><br>
                    Table: ${d.primary_table || 'N/A'}<br>
                    KPI: ${d.kpi_family || 'N/A'}<br>
                    Executions: ${d.execution_count || 0}<br>
                    Frequency: ${d.frequency_bucket || 'N/A'}
                `);
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            tooltip.style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', function(event) {
            d3.select('.tooltip')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select('.tooltip').remove();
        });
    
    // Update: animate existing bubbles
    bubbles
        .transition()
        .duration(1200)  // Smooth 1.2s animation
        .ease(d3.easeCubicInOut)
        .attr('cx', d => {
            if (!d || d.x === undefined) return 0;
            return d.x;  // Center X for circles
        })
        .attr('cy', d => {
            if (!d || d.y === undefined) return 0;
            return d.y;  // Center Y for circles
        })
        .attr('r', 4)  // Bigger radius
        .attr('fill', d => {
            if (!d) return '#1f77b4';
            const colorValue = d[currentColorEncoding] ? String(d[currentColorEncoding]) : 'unknown';
            const color = colorScale(colorValue);
            return (color && color !== 'undefined') ? color : '#1f77b4';
        })
        .attr('opacity', 0.9)  // Good opacity for distinct bubbles
        .attr('stroke', 'rgba(255,255,255,0.3)')  // White stroke for definition
        .attr('stroke-width', 0.5);  // Visible stroke
    
    // Enter: fade in new bubbles
    enter
        .transition()
        .duration(1200)
        .ease(d3.easeCubicInOut)
        .attr('opacity', 0.9);
    
    // Exit: remove old bubbles
    bubbles.exit()
        .transition()
        .duration(600)
        .attr('opacity', 0)
        .remove();
}

// Event listeners
document.getElementById('color-encoding').addEventListener('change', updateVisualization);
document.getElementById('layout-type').addEventListener('change', updateVisualization);
document.getElementById('sort-by').addEventListener('change', updateVisualization);

// Initialize on load
loadData();
