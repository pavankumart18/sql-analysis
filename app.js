
document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        data: [],
        originalData: [], // Preserve original order for reset
        colorMode: 'frequency_bucket',
        layoutMode: 'grouped', // Default to Stacks/SandDance
        sortMode: 'none',
        filter: null,
        activeSection: 'section-a'
    };

    // Constants - Premium Color Palette
    const COLORS = {
        freq: {
            '1 (Rare)': '#818cf8',      // Indigo (was Gray)
            '2 (Low)': '#2dd4bf',       // Teal (3-8)
            '3 (Medium)': '#facc15',    // Yellow (9-20)
            '4 (High)': '#fb923c',      // Orange (21-50)
            '5 (Critical)': '#ef4444'   // Red (>50)
        },
        kpiFamily: {
            'Revenue': '#3b82f6',    // Blue
            'Volume': '#10b981',     // Emerald
            'Efficiency': '#f59e0b'  // Amber
        },
        // Rich categorical palette
        palette: [
            '#818cf8', '#34d399', '#f472b6', '#60a5fa', '#a78bfa',
            '#fbbf24', '#2dd4bf', '#fb923c', '#c084fc', '#4ade80'
        ]
    };

    // DOM Elements
    const universeContainer = document.getElementById('universe-container');
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('section');
    const legendContainer = document.getElementById('legend-container-sidebar');

    // --- Initialization ---
    async function init() {
        try {
            // Use global data variable to avoid CORS issues with local file:// protocol
            if (typeof APP_DATA !== 'undefined') {
                state.data = APP_DATA;
                state.originalData = [...APP_DATA]; // Save original order
                const sidebarHeader = document.querySelector('.sidebar-header');
                if (sidebarHeader) {
                    const countDiv = document.createElement('div');
                    countDiv.style.marginLeft = 'auto'; // Push to right
                    countDiv.style.color = '#64748b';
                    countDiv.style.fontSize = '0.75rem';
                    countDiv.innerText = `${state.data.length} Qs`;
                    sidebarHeader.appendChild(countDiv);
                }
            } else {
                // Fallback if data.js didn't load for some reason
                const response = await fetch('app_data.json');
                state.data = await response.json();
            }

            // Initial Render
            renderUniverse();
            initControls();
            initNavigation();
            renderSectionB();
            renderSectionC();
        } catch (e) {
            console.error("Failed to load data", e);
            universeContainer.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#f87171; text-align:center;">
                <h3>Error loading data</h3>
                <p>Ensure data.js is loaded or app_data.json is accessible.</p>
                <div style="font-size:0.8rem; margin-top:0.5rem; opacity:0.7;">Check console for details</div>
            </div>`;
        }
    }

    // --- CLICK HANDLER ---
    window.openModal = function (itemIndex) {
        const item = state.data[itemIndex];
        const overlay = document.getElementById('modal-overlay');

        // Header
        document.getElementById('modal-title').innerHTML = `<i class="bi bi-code-square text-primary me-2"></i>Query: ${item.sql_id}`;
        document.getElementById('modal-subtitle').innerText = `Archetype: ${item.archetype || 'Ad-hoc'} | Table: ${item.primary_table}`;

        // Primary metadata
        document.getElementById('modal-freq').innerText = item.frequency_bucket || 'Unknown';
        document.getElementById('modal-table').innerText = item.primary_table || 'N/A';
        document.getElementById('modal-kpi').innerText = (item.kpis && item.kpis.length > 0) ? item.kpis.join(', ') : 'None detected';

        // Secondary metadata
        const familyEl = document.getElementById('modal-family');
        if (familyEl) familyEl.innerText = item.query_family || 'Adhoc';

        const execEl = document.getElementById('modal-exec');
        if (execEl) execEl.innerText = item.execution_count || 0;

        const complexityEl = document.getElementById('modal-complexity');
        if (complexityEl) {
            const numTables = item.num_tables || item.tables_used?.length || 1;
            const numKpis = item.kpis?.length || 1;
            complexityEl.innerText = numTables * numKpis;
        }

        // SQL block
        document.getElementById('modal-sql').innerText = item.sql_full || item.sql_preview || "SELECT * FROM ...";

        overlay.classList.add('active');
    };

    window.closeModal = function () {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('active');
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') window.closeModal();
    });

    // --- Navigation ---
    function initNavigation() {
        // Sticky Nav Highlighting or smooth scroll can be added here.
        // For now, HTML anchor tags handle the jump.

        // Ensure dots are positioned
        setTimeout(() => repositionDots(), 100);
    }

    // --- Section A Logic ---
    function initControls() {
        document.getElementById('color-select').addEventListener('change', (e) => {
            state.colorMode = e.target.value;
            updateDots();
            // If grouped layout, regrouping might be needed if group key depends on color
            if (state.layoutMode === 'grouped') repositionDots();
        });

        document.getElementById('layout-select').addEventListener('change', (e) => {
            state.layoutMode = e.target.value;
            repositionDots();
        });

        // Sort selector - dots animate smoothly since they're identified by sql_id
        document.getElementById('sort-select').addEventListener('change', (e) => {
            state.sortMode = e.target.value;
            applySorting();
            repositionDots(); // Smooth animation - dots move to new positions
        });

        // Populate Legend on Init
        updateLegend();
    }

    // Helper function to apply sorting to data
    function applySorting() {
        const mode = state.sortMode;

        // Restore original order
        if (mode === 'none') {
            state.data = [...state.originalData];
            return;
        }

        const getSortValue = (item) => {
            switch (mode) {
                case 'execution_count':
                    return item.execution_count || 0;
                case 'complexity_score':
                    return (item.num_tables || 1) * (item.kpis?.length || 1);
                case 'num_tables':
                    return item.num_tables || item.tables_used?.length || 1;
                case 'num_kpis':
                    return item.kpis?.length || 0;
                default:
                    return 0;
            }
        };

        // Sort descending (highest first)
        state.data.sort((a, b) => getSortValue(b) - getSortValue(a));
    }

    // Map to store dot elements by sql_id for smooth animations
    const dotElements = new Map();
    let resizeHandlerAttached = false;

    function renderUniverse() {
        // Check if dots already exist (re-render vs first render)
        const existingDots = dotElements.size > 0;

        if (!existingDots) {
            universeContainer.innerHTML = `
                <div id="group-labels"></div>
            `;

            // Create Dots using sql_id as stable identifier
            state.data.forEach((item) => {
                const dot = document.createElement('div');
                dot.className = 'dot';
                dot.id = `dot-${item.sql_id}`;
                dot.dataset.sqlId = item.sql_id;

                // Mouse Events - use sql_id for lookup
                dot.addEventListener('mouseenter', (e) => {
                    const dataItem = state.data.find(d => d.sql_id === item.sql_id);
                    if (dataItem) showTooltip(e, dataItem);
                });
                dot.addEventListener('mouseleave', hideTooltip);
                dot.addEventListener('click', () => {
                    const idx = state.data.findIndex(d => d.sql_id === item.sql_id);
                    if (idx >= 0) window.openModal(idx);
                });

                universeContainer.appendChild(dot);
                dotElements.set(item.sql_id, dot);
            });

            // Attach resize handler only once
            if (!resizeHandlerAttached) {
                window.addEventListener('resize', () => {
                    repositionDots();
                });
                resizeHandlerAttached = true;
            }
        }

        // Update colors and positions
        updateDots();
        setTimeout(() => repositionDots(), 50);
    }

    function getDotColor(item) {
        if (state.colorMode === 'frequency_bucket') {
            // New 5-point scale
            const execCount = item.execution_count || 1;
            if (execCount >= 50) return COLORS.freq['5 (Critical)'];
            if (execCount >= 21) return COLORS.freq['4 (High)'];
            if (execCount >= 9) return COLORS.freq['3 (Medium)'];
            if (execCount >= 3) return COLORS.freq['2 (Low)'];
            return COLORS.freq['1 (Rare)'];
        } else if (state.colorMode === 'kpi_family') {
            const family = item.primary_kpi_family || 'Volume';
            return COLORS.kpiFamily[family] || '#818cf8'; // Fallback to Indigo
        } else if (state.colorMode === 'query_family') {
            const family = item.query_family || 'Adhoc';
            const hash = family.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            return COLORS.palette[hash % COLORS.palette.length];
        } else {
            // Primary Table
            const hash = (item.primary_table || 'unknown').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            return COLORS.palette[hash % COLORS.palette.length];
        }
    }

    function updateDots() {
        state.data.forEach((item) => {
            const dot = dotElements.get(item.sql_id);
            if (dot) {
                dot.style.backgroundColor = getDotColor(item);
            }
        });
        updateLegend();
    }

    function updateLegend() {
        legendContainer.innerHTML = '';

        if (state.colorMode === 'frequency_bucket') {
            const buckets = [
                { label: '5 (Critical)', range: '>50' },
                { label: '4 (High)', range: '21-50' },
                { label: '3 (Medium)', range: '9-20' },
                { label: '2 (Low)', range: '3-8' },
                { label: '1 (Rare)', range: '1-2' }
            ];

            buckets.forEach(bucket => {
                // Count dynamically from client-side data to ensure accuracy with new buckets
                let countNum = 0;
                state.data.forEach(d => {
                    const exec = d.execution_count || 1;
                    if (bucket.label === '5 (Critical)' && exec >= 50) countNum++;
                    else if (bucket.label === '4 (High)' && exec >= 21 && exec < 50) countNum++;
                    else if (bucket.label === '3 (Medium)' && exec >= 9 && exec < 21) countNum++;
                    else if (bucket.label === '2 (Low)' && exec >= 3 && exec < 9) countNum++;
                    else if (bucket.label === '1 (Rare)' && exec < 3) countNum++;
                });

                const item = document.createElement('div');
                item.className = 'd-flex align-items-center mb-2';
                item.innerHTML = `
                <div class="rounded-pill me-2" style="width:12px; height:12px; background:${COLORS.freq[bucket.label]}"></div>
                <span class="text-secondary small">${bucket.label} <span class="ms-1 text-secondary opacity-50">(${countNum})</span></span>
            `;
                legendContainer.appendChild(item);
            });
        } else if (state.colorMode === 'kpi_family') {
            const families = [
                { name: 'Revenue', color: '#38bdf8' },
                { name: 'Volume', color: '#4ade80' },
                { name: 'Efficiency', color: '#facc15' }
            ];
            families.forEach(fam => {
                let countStr = '(0)';
                if (typeof APP_AGGREGATES !== 'undefined') {
                    // Sum counts for this family
                    const rows = APP_AGGREGATES.kpi_family_summary.filter(r => r.kpi_family === fam.name);
                    const total = rows.reduce((sum, r) => sum + r.sql_count, 0);
                    countStr = `(${total})`;
                }

                const item = document.createElement('div');
                item.className = 'd-flex align-items-center mb-2';
                item.innerHTML = `
                    <div class="rounded-pill me-2" style="width:12px; height:12px; background:${fam.color}"></div>
                    <span class="text-secondary small">${fam.name} <span class="ms-1 text-secondary opacity-50">${countStr}</span></span>
                `;
                legendContainer.appendChild(item);
            });
        }

        else if (state.colorMode === 'query_family') {
            // Generate dynamic legend for ALL families
            const counts = {};
            state.data.forEach(d => {
                const fam = d.query_family || 'Adhoc';
                counts[fam] = (counts[fam] || 0) + 1;
            });

            // Sort by count desc
            const sortedFams = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

            legendContainer.innerHTML = ''; // Reset

            sortedFams.forEach(fam => {
                // Replicate hash logic
                const hash = fam.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                const color = COLORS.palette[hash % COLORS.palette.length];

                const item = document.createElement('div');
                item.className = 'd-flex align-items-center mb-1';
                item.innerHTML = `
                    <div class="rounded-pill me-2" style="width:12px; height:12px; background:${color}"></div>
                    <span class="text-secondary small">${fam} <span class="ms-1 text-secondary opacity-50">(${counts[fam]})</span></span>
                 `;
                legendContainer.appendChild(item);
            });
        }
        else if (state.colorMode === 'primary_table') {
            // Generate dynamic legend for top tables
            const counts = {};
            state.data.forEach(d => {
                const tbl = d.primary_table || 'Unknown';
                counts[tbl] = (counts[tbl] || 0) + 1;
            });

            const sortedTbls = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

            legendContainer.innerHTML = '';

            sortedTbls.forEach(tbl => {
                const hash = tbl.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                const color = COLORS.palette[hash % COLORS.palette.length];

                const item = document.createElement('div');
                item.className = 'd-flex align-items-center mb-1';
                item.innerHTML = `
                    <div class="rounded-pill me-2" style="width:12px; height:12px; background:${color}"></div>
                    <span class="text-secondary small">${tbl} <span class="ms-1 text-secondary opacity-50">(${counts[tbl]})</span></span>
                 `;
                legendContainer.appendChild(item);
            });
        }
    }

    function repositionDots() {
        const labelContainer = document.getElementById('group-labels');
        if (labelContainer) labelContainer.innerHTML = '';

        const containerWidth = universeContainer.clientWidth;
        const containerHeight = universeContainer.clientHeight || 600; // Fallback height
        const totalItems = state.data.length || 1;

        // --- CALCULATION HELPER ---
        // Dynamically calculate dot size to try and fit inside the viewport
        // Area = w * h. AreaPerDot = Area / count. Side = sqrt(AreaPerDot).
        // scale factor 0.8 to leave some whitespace.
        const activeArea = containerWidth * containerHeight;
        const maxAreaPerDot = activeArea / totalItems;
        let calculatedSize = Math.floor(Math.sqrt(maxAreaPerDot) * 0.8);

        // Clamping
        calculatedSize = Math.max(4, Math.min(calculatedSize, 24));

        // Only trigger this auto-size if we are in Grid mode or want "adaptability" everywhere
        // For 'grouped', we might want columns to dictate width.

        // --- 1. GRID LAYOUT (The "Universe") ---
        if (state.layoutMode === 'grid') {
            const gap = Math.max(2, Math.floor(calculatedSize * 0.2));
            const dotSize = calculatedSize;
            const totalDotSize = dotSize + gap;

            // Recalculate cols based on dynamic size
            const cols = Math.floor(containerWidth / totalDotSize);
            // Center grid horizontally if possible
            const actualGridWidth = cols * totalDotSize;
            const startX = Math.max(0, (containerWidth - actualGridWidth) / 2);
            const startY = 20;

            state.data.forEach((item, index) => {
                const dot = dotElements.get(item.sql_id);
                if (!dot) return;

                const col = index % cols;
                const row = Math.floor(index / cols);

                const left = startX + (col * totalDotSize);
                const top = startY + (row * totalDotSize);

                dot.style.left = `${left}px`;
                dot.style.top = `${top}px`;
                dot.style.width = `${dotSize}px`;
                dot.style.height = `${dotSize}px`;
                dot.style.transform = 'none';
            });

            // --- 2. STACKS / GROUPED (SandDance) ---
        } else if (state.layoutMode === 'grouped') {

            let groupKey = 'kpi_family';
            if (state.colorMode === 'frequency_bucket') groupKey = 'frequency_bucket';
            if (state.colorMode === 'primary_table') groupKey = 'primary_table';

            const groups = {};
            state.data.forEach((item) => {
                const key = item[groupKey] || 'Other';
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });

            const groupNames = Object.keys(groups).sort();
            const numGroups = groupNames.length;

            // Layout params - dynamic sizing for columns
            const padding = 40;
            const availWidth = containerWidth - padding;
            const colWidth = Math.floor(availWidth / numGroups);

            // Calculate optimal dot size for the stacks to fit in height if possible? 
            // Or just maximize width usage.
            // Let's maximize width usage per column (e.g. 4 dots wide per column).
            // Try to aim for modest stacking.

            // Let's stick to the viewport calculation but maybe slightly smaller for stacks
            let stackDotSize = Math.max(4, Math.min(calculatedSize, 16));
            const gap = 2;
            const totalStackDotSize = stackDotSize + gap;

            const dotsPerRow = Math.max(2, Math.floor((colWidth - 10) / totalStackDotSize));

            // Recenter properly
            const totalAssemblyW = numGroups * colWidth;
            const startX = Math.max(20, (containerWidth - totalAssemblyW) / 2);

            let maxStackHeight = 0;

            groupNames.forEach((name, gIndex) => {
                const groupItems = groups[name];

                // Sort inside the stack?! (Optional, maybe by complexity)

                // Group Label
                const grpLeft = startX + (gIndex * colWidth);
                const label = document.createElement('div');
                label.className = 'group-label';
                label.innerText = name;
                label.style.left = `${grpLeft}px`;
                label.style.width = `${colWidth - 10}px`;
                label.style.bottom = '-30px'; // Temporarily bottom relative to... wait labels need absolute positioning
                // We'll position labels after we know heights? 
                // Actually, let's fix them to bottom of the viewport or standard baseline.
                // For scrolling page, standard baseline 600px is okay.
                const baselineY = Math.max(500, containerHeight - 50);

                label.style.top = `${baselineY + 10}px`;
                labelContainer.appendChild(label);

                groupItems.forEach((item, i) => {
                    const dot = dotElements.get(item.sql_id);
                    if (!dot) return;

                    // Stack logic
                    const stackCol = i % dotsPerRow;
                    const stackRow = Math.floor(i / dotsPerRow);

                    const dLeft = grpLeft + (stackCol * totalStackDotSize) + (colWidth - (dotsPerRow * totalStackDotSize)) / 2; // Center in col
                    const dTop = baselineY - (stackRow * totalStackDotSize) - totalStackDotSize;

                    dot.style.left = `${dLeft}px`;
                    dot.style.top = `${dTop}px`;
                    dot.style.width = `${stackDotSize}px`;
                    dot.style.height = `${stackDotSize}px`;
                    dot.style.transform = 'none';
                });
            });
            // --- 3. SCATTER (Complexity vs Frequency) ---
        } else if (state.layoutMode === 'scatter') {
            const padL = 60, padR = 40, padT = 40, padB = 60;
            const W = containerWidth - padL - padR;
            const H = containerHeight - padT - padB;

            // Compute Max from data for scaling
            const maxFreq = Math.max(20, ...state.data.map(d => d.execution_count || d.frequency || 1));
            const maxComp = Math.max(10, ...state.data.map(d => d.complexity_score || (d.tables.length * Math.max(1, d.kpis.length))));

            state.data.forEach((item) => {
                const dot = dotElements.get(item.sql_id);
                if (!dot) return;

                // X: Log Scale Frequency (Execution Count)
                const freq = item.execution_count || item.frequency || 1;
                const jitterFreq = freq + (Math.random() * 0.5);
                const normX = Math.log(Math.max(1, jitterFreq)) / Math.log(maxFreq + 1);

                // Y: Linear Complexity + Jitter
                const comp = item.complexity_score || 1;
                const jitterComp = comp + ((Math.random() - 0.5) * 2);
                const normY = Math.min(1, Math.max(0, jitterComp / maxComp));

                const left = padL + (normX * W);
                const top = (padT + H) - (normY * H);

                dot.style.left = `${left}px`;
                dot.style.top = `${top}px`;
                dot.style.width = '8px';
                dot.style.height = '8px';
                dot.style.transform = 'none';
            });

            // Axes
            if (labelContainer) {
                const xL = document.createElement('div');
                xL.className = 'axis-label';
                xL.innerText = 'Frequency (Executions) →';
                xL.style.right = '40px'; xL.style.bottom = '20px';
                labelContainer.appendChild(xL);

                const yL = document.createElement('div');
                yL.className = 'axis-label';
                yL.innerText = 'Complexity Score (Tables × KPIs) ↑';
                yL.style.left = '20px'; yL.style.top = '20px';
                labelContainer.appendChild(yL);
            }
        }
    }

    function showTooltip(e, item) {
        // Header
        document.getElementById('tt-id').innerText = item.sql_id;
        document.getElementById('tt-freq-badge').innerText = item.frequency_bucket;

        // Primary Table
        document.getElementById('tt-table').innerText = item.primary_table;

        // KPIs
        let kpiText = 'None';
        if (item.kpis && item.kpis.length > 0) {
            kpiText = item.kpis.length > 2 ? `${item.kpis[0]}, ${item.kpis[1]} +${item.kpis.length - 2}` : item.kpis.join(', ');
        }
        document.getElementById('tt-kpi').innerText = kpiText;

        // KPI Family
        const kpiFamilyEl = document.getElementById('tt-kpi-family');
        if (kpiFamilyEl) kpiFamilyEl.innerText = item.primary_kpi_family || 'N/A';

        // Query Family
        const familyEl = document.getElementById('tt-family');
        if (familyEl) familyEl.innerText = item.query_family || 'Adhoc';

        // Executions
        const execEl = document.getElementById('tt-exec');
        if (execEl) execEl.innerText = item.execution_count || 0;

        // Complexity Score (Tables × KPIs)
        const complexityEl = document.getElementById('tt-complexity');
        if (complexityEl) {
            const numTables = item.num_tables || item.tables_used?.length || 1;
            const numKpis = item.kpis?.length || 1;
            complexityEl.innerText = numTables * numKpis;
        }

        // SQL Preview
        const sqlText = item.sql_full || item.sql_preview || "SELECT * FROM ...";
        document.getElementById('tt-sql').innerText = sqlText;

        const rect = e.target.getBoundingClientRect();
        const tTip = document.getElementById('tooltip');

        // Smart Position - shift a bit more to avoid covering mouse
        let top = rect.top - 20;
        let left = rect.right + 20;

        // Prevent offscreen
        // Tooltip is now wider (450px)
        if (left + 460 > window.innerWidth) left = rect.left - 470;
        if (top + 300 > window.innerHeight) top = window.innerHeight - 310;

        tTip.style.top = `${top}px`;
        tTip.style.left = `${left}px`;
        tTip.style.opacity = '1';
    }

    function hideTooltip() {
        tooltip.style.opacity = '0';
    }

    // --- Section B: Process Data ---
    // --- Section B: Process Data ---
    const PROCESS_STAGES = [
        {
            title: "1. Capture",
            fullName: "The Raw Reality",
            desc: "We didn't ask analysts what they need. We watched what they did.",
            tags: ["1,543 Queries", "No Interviews"],
            details: {
                in: "The messy, unfiltered reality of daily SQL execution logs.",
                out: "A complete forensic record of every question asked.",
                why: "Surveys lie. Code logs tell the truth. We started by capturing 100% of the workload to avoid 'loudest voice' bias.",
                artifact: "postgresql_2025_01.log",
                rawData: `2025-01-15 08:30:01 UTC [29302]: user=analyst_jdb, db=sales_dw, query="SELECT * FROM sales_raw WHERE region = 'EAST' LIMIT 100"
2025-01-15 08:31:12 UTC [29302]: user=analyst_jdb, db=sales_dw, query="select s.id, s.amount, c.name from sales_raw s join customers c on s.cust_id = c.id where s.date > '2024-01-01'"
2025-01-15 08:35:44 UTC [29451]: user=sr_analyst_m, db=sales_dw, query="SELECT date_trunc('month', trans_date) as m, sum(rev) FROM legacy_revenue_table GROUP BY 1"
2025-01-15 09:01:22 UTC [29302]: user=analyst_jdb, db=sales_dw, query="select count(*) from staging_orders_v2"
2025-01-15 09:05:00 UTC [SYSTEM]: user=tableau_svc, db=sales_dw, query="SELECT t1.col1, t1.col2, t2.col3 FROM dim_products t1 LEFT JOIN fact_inventory t2 ON t1.id = t2.prod_id WHERE t2.stock_level < 10"
2025-01-15 09:12:15 UTC [29882]: user=data_sci_k, db=experimental, query="create table temp_analysis_k as select * from raw_leads where score > 0.8"
2025-01-15 09:14:30 UTC [29111]: user=intern_1, db=sales_dw, query="SELECT * FROM users -- checking formatting"
2025-01-15 09:20:01 UTC [29302]: user=analyst_jdb, db=sales_dw, query="SELECT count(DISTINCT order_id) FROM sales_final WHERE return_flag IS NULL"
2025-01-15 09:22:55 UTC [29451]: user=sr_analyst_m, db=sales_dw, query="WITH regional_sales AS (SELECT r.name, sum(s.amt) FROM risk_table r JOIN sales s ON ...)"
2025-01-15 09:30:10 UTC [29999]: user=etl_process, db=sales_dw, query="INSERT INTO daily_agg_sales SELECT * FROM staging_sales_delta"
... (1,533 lines omitted)`
            }
        },
        {
            title: "2. Parse",
            fullName: "Structural Parsing",
            desc: "Turning text into trees. Understanding intent vs syntax.",
            tags: ["AST Parsing", "Normalization"],
            details: {
                in: "Raw SQL strings.",
                out: "Abstract Syntax Trees (ASTs) identifying tables, columns, and joins.",
                why: "Regex isn't enough. We need to know that 'FROM sales s' and 'FROM public.sales' are the same table.",
                artifact: "parsed_ast.json",
                rawData: `{
  "query_hash": "a1b2c3d4",
  "statement_type": "SELECT",
  "tables": [
    { "name": "sales_raw", "alias": "s", "schema": "public", "access_type": "READ" },
    { "name": "customers", "alias": "c", "schema": "public", "access_type": "READ" }
  ],
  "columns": [
    { "expr": "s.id", "source_table": "sales_raw", "source_col": "id" },
    { "expr": "sum(s.amount)", "aggregation": "SUM", "source_col": "amount" }
  ],
  "joins": [
    { "left": "sales_raw", "right": "customers", "condition": "s.cust_id = c.id", "type": "INNER" }
  ],
  "filters": [
    { "clause": "s.date > '2024-01-01'", "column": "date", "operator": ">" }
  ],
  "complexity": { "depth": 1, "width": 3, "score": 4.5 }
}
... (Processing 100 queries/sec)`
            }
        },
        {
            title: "3. Extract",
            fullName: "Feature Extraction",
            desc: "We can't compare text. We compare features.",
            tags: ["Metadata", "Fingerprinting"],
            details: {
                in: "Parsed SQL trees.",
                out: "Feature sets: [Fact_Sales, Join_Customer, KPI_Revenue]",
                why: "This turns code into comparable data points. We map every query to the specific business concepts it touches.",
                artifact: "sql_universe.csv",
                rawData: `sql_id,timestamp,user,tables_used,columns_accessed,has_aggregates,has_joins,kpi_detected
Q_101,2025-01-15T08:31:12,analyst_jdb,"['sales_raw','customers']","['id','amount','name']",false,true,null
Q_102,2025-01-15T08:35:44,sr_analyst_m,"['legacy_revenue']","['trans_date','rev']",true,false,"Monthly Revenue"
Q_103,2025-01-15T09:05:00,tableau_svc,"['dim_products','fact_inventory']","['col1','col2','stock']",false,true,"Inventory Risk"
Q_104,2025-01-15T09:20:01,analyst_jdb,"['sales_final']","['order_id','return_flag']",true,false,"Return Rate"
Q_105,2025-01-15T10:00:15,analyst_gen,"['users','orders']","['uid','oid','amt']",false,true,"User Spend"
...
Matrix Generation:
[1, 1, 0, 0, 1] -> Cluster A (Revenue Analysis)
[0, 1, 1, 1, 0] -> Cluster B (Inventory Ops)
[1, 0, 0, 0, 0] -> Cluster C (Adhoc Checks)`
            }
        },
        {
            title: "4. Heat",
            fullName: "Measuring the Heat",
            desc: "What's actually hot? (It wasn't what we expected).",
            tags: ["Frequency", "Recency"],
            details: {
                in: "Execution Counts + Timestamps.",
                out: "The 2% of data that powers 80% of decisions.",
                why: "We found 800+ ad-hoc queries run once. But we found 9 queries run 500+ times. That's where the value is.",
                artifact: "usage_heatmap.csv",
                rawData: `Pattern_Hash,Execution_Count,Last_Run,Unique_Users,Avg_Runtime_Ms,Business_Value_Score
H_9921 (Daily Rev), 543, 2025-01-30 08:00, 12, 4500, 98.5 (CRITICAL)
H_8823 (Inventory), 412, 2025-01-30 09:15, 8, 1200, 85.2 (HIGH)
H_1102 (User List), 380, 2025-01-29 17:00, 25, 200, 72.0 (HIGH)
H_7741 (Exp. Join), 89, 2025-01-28 14:00, 2, 15000, 45.1 (MEDIUM)
H_3321 (Testing), 15, 2025-01-15 10:00, 1, 50, 10.0 (LOW)
H_0012 (Adhoc 1), 1, 2025-01-01 12:00, 1, 900, 1.0 (RARE)
H_0013 (Adhoc 2), 1, 2025-01-01 12:05, 1, 1100, 1.0 (RARE)
...
Insight: Top 9 Patterns account for 72% of total compute time.`
            }
        },
        {
            title: "5. Archetypes",
            fullName: "Finding the Archetypes",
            desc: "The 9 Hidden Patterns that govern the business.",
            tags: ["Clustering", "Discovery"],
            details: {
                in: "Usage-weighted clusters.",
                out: "9 Core Business Questions (Archetypes).",
                why: "Despite 1,500 different files, the business effectively only asks 9 things. These are your new products.",
                artifact: "archetypes.json",
                rawData: `Clustering Results (DBSCAN + TF-IDF on Query Fragments):

Cluster 1: "Global Revenue Reporting" (Size: 520 queries)
- Central Concept: sum(sales.amount), date_trunc('month', date)
- Variation: Currency conversion, Region filters
-> ARCHETYPE 1: "Financial Performance"

Cluster 2: "User Growth & Churn" (Size: 310 queries)
- Central Concept: count(distinct user_id), active_status = false
- Join Pattern: users -> subscriptions -> cancellations
-> ARCHETYPE 2: "Customer Lifecycle"

Cluster 3: "Inventory Logistics" (Size: 250 queries)
- Central Concept: stock_level < reorder_point, warehouse_id
-> ARCHETYPE 3: "Supply Chain Risk"

... (6 Archetypes omitted)`
            }
        },
        {
            title: "6. The Build",
            fullName: "The Data Product",
            desc: "Stop building everything. Build the 9 interactions.",
            tags: ["Middle Layer", "Schema"],
            details: {
                in: "The 9 Archetypes.",
                out: "3 Clean Tables + 12 Standard Metrics.",
                why: "Instead of a swamp, you now have a paved road. We built the middle layer to answer the 9 questions instantly.",
                artifact: "proposed_schema.sql",
                rawData: `-- BASED ON ARCHETYPE 1 (Revenue) & 2 (Customer)
-- We consolidate 15 raw tables into 1 verified Gold Table

CREATE TABLE gold.fact_revenue_daily AS
SELECT
    date_trunc('day', transaction_date) as report_date,
    region_id,
    product_category,
    -- Standardized Metrics (No more math in BI tools)
    SUM(amount_usd) as revenue_usd,
    COUNT(DISTINCT transaction_id) as vol_transactions,
    SUM(CASE WHEN is_return THEN amount_usd ELSE 0 END) as return_loss
FROM raw.all_sales_combined
WHERE is_test_account = FALSE -- Global Rule Applied Here
GROUP BY 1, 2, 3;

-- This single table answers 65% of all Adhoc Questions traced in Section 1.
-- Maintenance reduced from 15 ETL pipelines to 1.`
            }
        }
    ];

    function renderSectionB() {
        const container = document.getElementById('process-stages-wrapper');
        container.innerHTML = `
            <div class="pipeline-container">
                <div class="pipeline-visual"></div>
                
                <!-- New Plot Area -->
                <div id="pipeline-charts" style="display:flex; gap:10px; justify-content:center; margin: 20px 0;"></div>

                <div class="pipeline-details" id="pipeline-details-panel">
                    <div class="placeholder-text">Select a stage to view analysis details</div>
                </div>
            </div>
        `;

        const visualContainer = container.querySelector('.pipeline-visual');
        const detailsPanel = document.getElementById('pipeline-details-panel');

        PROCESS_STAGES.forEach((stage, i) => {
            // Arrow (except first)
            if (i > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'pipeline-arrow';
                arrow.innerHTML = '→';
                visualContainer.appendChild(arrow);
            }

            const node = document.createElement('div');
            node.className = 'pipeline-node';
            // Default select first one
            if (i === 0) node.classList.add('active');

            node.innerHTML = `
                <div class="node-title">${stage.title}</div>
                <div class="node-desc" style="font-size:0.75rem; color:#94a3b8; margin-top:4px; line-height:1.3;">${stage.desc || stage.tags.join(' • ')}</div>
            `;

            node.addEventListener('click', () => {
                // UI Toggle
                document.querySelectorAll('.pipeline-node').forEach(n => n.classList.remove('active'));
                node.classList.add('active');
                renderPipelineChart(PROCESS_STAGES[i]); // Keep chart rendering
                updateDetails(i); // Call new updateDetails
            });

            visualContainer.appendChild(node);
        });

        // Initialize with first stage
        renderPipelineChart(PROCESS_STAGES[0]); // Keep chart rendering
        updateDetails(0); // Call new updateDetails
    }

    function renderPipelineChart(stage) {
        const container = document.getElementById('pipeline-charts');
        container.innerHTML = '';
        const width = 600;
        const height = 200;

        // Tooltip setup (singleton)
        let tooltip = document.querySelector('.d3-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'd3-tooltip';
            document.body.appendChild(tooltip);
        }

        const showTip = (e, html) => {
            tooltip.innerHTML = html;
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY - 28) + 'px';
            tooltip.style.opacity = 1;
        };
        const hideTip = () => {
            tooltip.style.opacity = 0;
        };

        const svg = d3.select("#pipeline-charts")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("class", "d3-chart-bg")
            .style("border-radius", "8px");

        let data = [];
        let type = 'bar';

        if (stage.title.includes("Capture")) {
            // Activity Volume Curve
            type = 'line';
            data = [
                { t: '08:00', v: 50 }, { t: '08:30', v: 80 }, { t: '09:00', v: 340 }, { t: '09:30', v: 420 },
                { t: '10:00', v: 200 }, { t: '10:30', v: 180 }, { t: '11:00', v: 150 }, { t: '11:30', v: 120 }
            ];
            svg.append("text").attr("x", width / 2).attr("y", 20).attr("text-anchor", "middle").attr("fill", "#94a3b8").text("Ingestion Volume (Peak Morning Load)");

        } else if (stage.title.includes("Parse")) {
            // 100% Success Ring
            type = 'ring';
            const g = svg.append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

            g.append("circle").attr("r", 60).attr("fill", "none").attr("stroke", "#334155").attr("stroke-width", 15);
            const path = g.append("path")
                .datum({ endAngle: 2 * Math.PI })
                .style("fill", "#22c55e")
                .attr("d", d3.arc().innerRadius(52).outerRadius(68).startAngle(0));

            g.append("text").attr("y", 5).attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "20px").style("font-weight", "bold").text("1,543");
            g.append("text").attr("y", 25).attr("text-anchor", "middle").attr("fill", "#94a3b8").style("font-size", "12px").text("Parsed");

            path.on("mousemove", (e) => showTip(e, "100% Success Rate<br>0 Parse Errors"))
                .on("mouseout", hideTip);

            return;

        } else if (stage.title.includes("Extract") || stage.title.includes("DNA")) {
            // Feature Matrix Visualization
            svg.append("text").attr("x", width / 2).attr("y", 20).attr("text-anchor", "middle").attr("fill", "#94a3b8").text("Feature Extraction Map (Tables × Columns)");
            type = 'matrix';
            const features = ["Has Join", "Uses Agg", "Filter Date", "KPI Vol", "KPI Rev", "Dim Cust", "Fact Sales"];
            const cols = 20; const rows = 7;

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const active = Math.random() > 0.6;
                    const featName = features[j];
                    const queryId = `Q_${100 + i}`;

                    svg.append("rect")
                        .attr("x", 100 + (i * 20))
                        .attr("y", 40 + (j * 16))
                        .attr("width", 16).attr("height", 12)
                        .attr("fill", active ? "#38bdf8" : "#1e293b")
                        .attr("rx", 2)
                        .attr("opacity", active ? 0.9 : 0.5)
                        .on("mousemove", (e) => showTip(e, `<strong>${queryId}</strong><br>${featName}: ${active}`))
                        .on("mouseout", hideTip);
                }
            }
            // Row Labels
            features.forEach((f, i) => {
                svg.append("text").attr("x", 90).attr("y", 50 + (i * 16)).attr("text-anchor", "end").attr("fill", "#64748b").style("font-size", "9px").text(f);
            });
            return;

        } else if (stage.title.includes("Heat")) {
            // Power Law Distribution (Exact Data Match)
            type = 'bar';
            // Data from the rawData sample: 543, 412, 380, 89, 15, 1, 1...
            data = [
                { l: 'Daily Rev', v: 543, c: '#ef4444' },
                { l: 'Inventory', v: 412, c: '#fb923c' },
                { l: 'User List', v: 380, c: '#fb923c' },
                { l: 'Exp. Join', v: 89, c: '#2dd4bf' },
                { l: 'Testing', v: 15, c: '#cbd5e1' },
                { l: 'Adhoc 1', v: 1, c: '#64748b' },
                { l: 'Adhoc 2', v: 1, c: '#64748b' }
            ];
            svg.append("text").attr("x", width / 2).attr("y", 20).attr("text-anchor", "middle").attr("fill", "#94a3b8").text("Execution Frequency (Top Patterns)");

        } else if (stage.title.includes("Archetypes")) {
            // Clusters (Revenue, User, Inventory)
            type = 'bubble';
            // Data from rawData sample
            const bubbles = [
                // Revenue (520)
                { x: 200, y: 100, r: 50, c: '#ef4444', label: 'Rev Report', count: 520, desc: 'Sum(Amount)' },
                // User (310)
                { x: 320, y: 80, r: 40, c: '#38bdf8', label: 'User Growth', count: 310, desc: 'Count(Distinct UID)' },
                // Inventory (250)
                { x: 420, y: 120, r: 35, c: '#facc15', label: 'Logistics', count: 250, desc: 'Stock < Limit' },
            ];

            bubbles.forEach(b => {
                const circle = svg.append("circle")
                    .attr("cx", b.x).attr("cy", b.y).attr("r", b.r)
                    .attr("fill", b.c).attr("opacity", 0.8)
                    .attr("stroke", "#fff").attr("stroke-width", 1)
                    .style("cursor", "pointer");

                circle.on("mousemove", (e) => showTip(e, `<strong>${b.label}</strong><br>Queries: ${b.count}<br>Pattern: ${b.desc}`))
                    .on("mouseout", hideTip);

                svg.append("text").attr("x", b.x).attr("y", b.y + 4).attr("text-anchor", "middle").attr("fill", "#fff")
                    .style("font-size", "10px").style("font-weight", "bold").style("pointer-events", "none").text(b.label);
            });
            svg.append("text").attr("x", width / 2).attr("y", 185).attr("text-anchor", "middle").attr("fill", "#94a3b8").text("Identified Business Archetypes (Cluster Size)");
            return;

        } else {
            // Reduction (Build)
            svg.append("rect").attr("x", 150).attr("y", 80).attr("width", 50).attr("height", 60).attr("fill", "#ef4444")
                .on("mousemove", e => showTip(e, "15 Raw Tables<br>High Maintenance"))
                .on("mouseout", hideTip);

            svg.append("text").attr("x", 175).attr("y", 160).attr("text-anchor", "middle").attr("fill", "#ef4444").text("15 Tables");

            svg.append("text").attr("x", 300).attr("y", 110).attr("text-anchor", "middle").attr("fill", "#fff").style("font-size", "24px").text("→");

            svg.append("rect").attr("x", 400).attr("y", 60).attr("width", 80).attr("height", 100).attr("fill", "#22c55e")
                .on("mousemove", e => showTip(e, "1 Gold Table<br>Verified Metrics"))
                .on("mouseout", hideTip);

            svg.append("text").attr("x", 440).attr("y", 180).attr("text-anchor", "middle").attr("fill", "#22c55e").text("1 Clean Table");

            svg.append("text").attr("x", width / 2).attr("y", 30).attr("text-anchor", "middle").attr("fill", "#94a3b8").text("Schema Consolidation");
            return;
        }

        if (type === 'bar') {
            const xScale = d3.scaleBand().domain(d3.range(data.length)).range([50, width - 50]).padding(0.2);
            // Dynamic max
            const maxVal = d3.max(data, d => d.v);
            const yScale = d3.scaleLinear().domain([0, maxVal]).range([height - 40, 40]);

            svg.selectAll("rect")
                .data(data)
                .enter().append("rect")
                .attr("x", (d, i) => xScale(i))
                .attr("y", d => yScale(d.v))
                .attr("width", xScale.bandwidth())
                .attr("height", d => height - 40 - yScale(d.v))
                .attr("fill", d => d.c || "#38bdf8")
                .attr("opacity", 0.9)
                .on("mousemove", (e, d) => showTip(e, `<strong>${d.l}</strong><br>Count: ${d.v}`))
                .on("mouseout", hideTip);

        } else if (type === 'line') {
            const xScale = d3.scalePoint().domain(data.map(d => d.t)).range([50, width - 50]);
            const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.v)]).range([height - 40, 40]);

            const line = d3.line().x(d => xScale(d.t)).y(d => yScale(d.v)).curve(d3.curveMonotoneX);
            svg.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", "#38bdf8").attr("stroke-width", 3);

            // Dots
            svg.selectAll("circle")
                .data(data)
                .enter().append("circle")
                .attr("cx", d => xScale(d.t))
                .attr("cy", d => yScale(d.v))
                .attr("r", 4)
                .attr("fill", "#1e293b")
                .attr("stroke", "#38bdf8")
                .attr("stroke-width", 2)
                .on("mousemove", (e, d) => showTip(e, `Time: ${d.t}<br>Queries: ${d.v}`))
                .on("mouseout", hideTip);

            // Area
            const area = d3.area().x(d => xScale(d.t)).y0(height - 40).y1(d => yScale(d.v)).curve(d3.curveMonotoneX);
            svg.append("path").datum(data).attr("d", area).attr("fill", "#38bdf8").attr("opacity", 0.1);
        }
    }

    // Update Details Logic to include Raw Data
    function updateDetails(index) {
        const data = PROCESS_STAGES[index];
        const detailsPanel = document.getElementById('pipeline-details-panel');

        const tagsHtml = data.tags.map(t => `<span class="badge bg-secondary me-2" style="font-weight:500; letter-spacing:0.5px;">${t}</span>`).join('');

        // Single Column Layout for linear flow
        detailsPanel.innerHTML = `
             <div class="row justify-content-center">
                 <div class="col-lg-10">
                    <div class="d-flex align-items-center mb-4 border-bottom border-secondary pb-3">
                         <h3 class="fw-bold text-body mb-0 me-3" style="font-family: 'Playfair Display', serif;">${data.fullName}</h3>
                         <div class="ms-auto">${tagsHtml}</div>
                    </div>
                    
                    <div class="detail-block why mb-5">
                       <label class="text-warning text-uppercase small fw-bold mb-2"><i class="bi bi-lightbulb me-2"></i>The Insight</label>
                       <p class="lead text-body" style="font-size: 1.1rem; line-height: 1.6;">${data.details.why}</p>
                   </div>
                   
                   <div class="row mb-5">
                        <div class="col-md-6">
                            <div class="detail-block input p-3 border border-secondary rounded code-block-bg">
                                <label class="text-uppercase small fw-bold text-secondary mb-2">Input</label>
                                <p class="mb-0 text-secondary">${data.details.in}</p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="detail-block output p-3 border border-primary rounded" style="background: rgba(14, 165, 233, 0.1);">
                                <label class="text-uppercase small fw-bold text-primary mb-2">Output</label>
                                <p class="mb-0 text-body">${data.details.out}</p>
                            </div>
                        </div>
                   </div>

                    <!-- Raw Data Preview (Moved Below) -->
                    <div class="mb-4">
                        <label class="d-block text-secondary small fw-bold text-uppercase mb-2">
                            <i class="bi bi-code-square me-2"></i>Sample Evidence
                        </label>
                        <div class="code-block-bg border border-secondary rounded p-3 text-monospace shadow-sm" 
                             style="font-family: 'Consolas', monospace; font-size: 0.8rem; color: var(--accent-color); height: auto; max-height: 400px; overflow-y: auto; white-space: pre-wrap;">
                            ${data.details.rawData || 'No sample data available.'}
                        </div>
                    </div>
                    
                    <div class="text-center mt-5 pt-3 border-top border-secondary">
                        <span class="detail-artifact btn btn-outline-primary px-4 py-2 rounded-pill">
                            <i class="bi bi-file-earmark-code me-2"></i>
                            View Full Artifact: <span class="fw-bold ms-1 text-body">${data.details.artifact}</span>
                        </span>
                    </div>
                 </div>
             </div>
        `;
    }

    // --- Section C: Middle Layer Data ---
    // These tables are NOT designed upfront — they emerged from how analysts actually work.
    const MIDDLE_LAYER_DATA = [
        {
            id: 'ml_1',
            name: 'fact_query_usage',
            type: 'fact',
            purpose: 'Enables reasoning about the SQL workload itself — what runs, how often, and why.',
            impact: 'Connects usage patterns to data strategy decisions.',
            impactDetail: 'Powers introspection: links Section A exploration to structural recommendations.',
            pain: 'Eliminates need to re-analyze raw query logs for every optimization decision.',
            bullets: [
                'Derived from 1,500+ observed SQL executions',
                'Enables workload-driven schema recommendations',
                'Foundation for continuous optimization'
            ],
            schema: [
                {
                    name: 'sql_id',
                    type: 'VARCHAR',
                    what: 'Unique identifier for each distinct query pattern',
                    why: 'Appears as the grain in every analysis — essential for traceability.',
                    how: 'Hash of normalized SQL structure'
                },
                {
                    name: 'execution_count',
                    type: 'INTEGER',
                    what: 'Number of times this query was executed',
                    why: 'Appears in 100% of workload analyses — the core usage metric.',
                    how: 'Aggregated count from execution logs'
                },
                {
                    name: 'frequency_bucket',
                    type: 'VARCHAR',
                    what: 'Usage tier: High, Medium, or Low',
                    why: 'Used by analysts to prioritize optimization efforts.',
                    how: 'Derived from execution_count thresholds (>20, 5-20, <5)'
                },
                {
                    name: 'complexity_score',
                    type: 'INTEGER',
                    what: 'Estimated structural complexity',
                    why: 'Helps identify queries that benefit most from simplification.',
                    how: 'Weighted formula: tables × joins × KPI count'
                },
                {
                    name: 'query_family',
                    type: 'VARCHAR',
                    what: 'Semantic intent category',
                    why: 'Enables grouping queries by business purpose, not just syntax.',
                    how: 'Derived from KPI patterns and time grain analysis'
                }
            ]
        },
        {
            id: 'ml_2',
            name: 'fact_core_metrics',
            type: 'fact',
            purpose: 'Standardized KPIs that analysts compute repeatedly — now pre-calculated.',
            impact: 'Impacts 68% of observed queries.',
            impactDetail: 'Used by 5 of the 6 most frequent query families.',
            pain: 'Eliminates repeated KPI calculations that appear across 12+ different formulas.',
            bullets: [
                'Appears in 68% of SQL queries',
                'Replaces 12 ad-hoc revenue formulas with one standard',
                'Enables consistent metrics across all dashboards'
            ],
            schema: [
                {
                    name: 'metric_date',
                    type: 'DATE',
                    what: 'The date grain for reporting',
                    why: 'Required by 95% of queries — the universal time dimension.',
                    how: 'Truncated from transaction timestamps with timezone normalization'
                },
                {
                    name: 'entity_id',
                    type: 'VARCHAR',
                    what: 'Foreign key to dim_entity',
                    why: 'Enables consistent joins — appears in 72% of queries.',
                    how: 'Lookup from source transaction records'
                },
                {
                    name: 'net_revenue',
                    type: 'DECIMAL',
                    what: 'Standardized net revenue after adjustments',
                    why: 'Appears in 58% of queries — the most reused KPI.',
                    how: 'SUM(face_value - discount) with consistent refund logic'
                },
                {
                    name: 'tickets_sold',
                    type: 'INTEGER',
                    what: 'Count of unique tickets transacted',
                    why: 'Second most common KPI — used by sales, ops, and marketing.',
                    how: 'COUNT(DISTINCT ticket_id) with status filters applied'
                },
                {
                    name: 'gross_revenue',
                    type: 'DECIMAL',
                    what: 'Total revenue before adjustments',
                    why: 'Used in 45% of queries for executive dashboards.',
                    how: 'SUM(gross_revenue) from standardized source'
                }
            ]
        },
        {
            id: 'ml_3',
            name: 'dim_entity',
            type: 'dim',
            purpose: 'Pre-joined entity attributes that analysts repeat everywhere.',
            impact: 'Simplifies 54% of observed queries.',
            impactDetail: 'Removes the same 3-table join pattern found in 800+ queries.',
            pain: 'Eliminates the customer lookup logic duplicated across analysts.',
            bullets: [
                'Join pattern appears in 54% of queries',
                'Consolidates 3 repeated lookups into 1 dimension',
                'Enables consistent filtering and segmentation'
            ],
            schema: [
                {
                    name: 'entity_id',
                    type: 'VARCHAR',
                    what: 'Primary key for the entity dimension',
                    why: 'The join key that appears in nearly every analytical query.',
                    how: 'Natural key from source system'
                },
                {
                    name: 'entity_name',
                    type: 'VARCHAR',
                    what: 'Display name for reporting',
                    why: 'Required for human-readable outputs in all dashboards.',
                    how: 'Direct mapping from master data'
                },
                {
                    name: 'segment',
                    type: 'VARCHAR',
                    what: 'Customer segment classification',
                    why: 'Filtered in 42% of queries — the most common WHERE clause.',
                    how: 'Derived from RFM analysis, refreshed weekly'
                },
                {
                    name: 'country',
                    type: 'VARCHAR',
                    what: 'Geographic region',
                    why: 'Second most common filter — used for regional reporting.',
                    how: 'Standardized country code from address data'
                },
                {
                    name: 'lifetime_value',
                    type: 'DECIMAL',
                    what: 'Pre-calculated customer lifetime value',
                    why: 'Replaces ad-hoc CLV calculations found in 35% of marketing queries.',
                    how: 'Predictive model output, updated monthly'
                }
            ]
        }
    ];

    function renderSectionC() {
        const sectionC = document.getElementById('section-c');

        // --- 1. Top Narrative (Key Message) ---
        let narrative = document.getElementById('c-narrative');
        if (!narrative) {
            narrative = document.createElement('div');
            narrative.id = 'c-narrative';
            narrative.innerHTML = `
                <div class="middle-layer-intro text-center mx-auto mb-5 pb-4 border-bottom border-light" style="max-width:800px;">
                    <h2 class="section-title mb-3 fs-2 text-headings">The Middle Layer: <span class="text-success fw-bold">Derived, Not Guessed</span></h2>
                    
                    <div class="intro-grid d-grid gap-4 text-start mt-4 mx-auto" style="grid-template-columns: 1fr auto 1fr; align-items:center;">
                        <div class="problem-card p-4 rounded-3">
                            <div class="text-uppercase small fw-bold tracking-wide text-secondary mb-2">Problem</div>
                            <div class="fs-5 fw-bold text-headings">1,500 Ad-Hoc Scripts</div>
                        </div>
                        <div class="d-flex align-items-center justify-content-center text-primary">
                            <i class="bi bi-arrow-right fs-2"></i>
                        </div>
                        <div class="solution-card p-4 rounded-3 border border-primary bg-primary bg-opacity-10">
                            <div class="text-uppercase small fw-bold tracking-wide text-primary mb-2">Solution</div>
                            <div class="fs-5 fw-bold text-headings">3 Clean Tables</div>
                        </div>
                    </div>

                    <p class="story-text fs-5 mt-4 text-secondary mx-auto" style="max-width:700px; line-height:1.6;">
                        We didn't sit in a room and design this schema on a whiteboard. 
                        We let the <strong class="text-headings">usage data</strong> tell us what to build. 
                        These 3 tables alone solve 80% of the daily analytical workload.
                    </p>
                </div>
            `;
            sectionC.insertBefore(narrative, sectionC.children[0]);
        }

        // --- 2. Explorer Layout Wrapper ---
        const layoutContainer = document.querySelector('.middle-layer-layout');
        layoutContainer.innerHTML = '';
        layoutContainer.style.display = 'flex';

        // --- Left: Accordion Navigation ---
        const sidebar = document.createElement('div');
        sidebar.className = 'explorer-sidebar bg-panel border border-light';
        sidebar.innerHTML = `
            <div class="explorer-header border-bottom border-light p-3 d-flex align-items-center gap-2">
                <i class="bi bi-list-nested text-primary"></i>
                <span class="fw-bold text-headings">Derived Tables</span>
                <span class="ms-auto small text-secondary">${MIDDLE_LAYER_DATA.length} tables</span>
            </div>
            <div id="accordion-container" class="flex-grow-1 overflow-auto custom-scrollbar"></div>
        `;
        layoutContainer.appendChild(sidebar);

        // --- Right: Schema Details Panel ---
        const detailsPanel = document.createElement('div');
        detailsPanel.className = 'schema-panel bg-panel border-light';
        detailsPanel.id = 'explorer-details';
        detailsPanel.innerHTML = `<div class="placeholder-text text-secondary p-5 text-center">Select a table to view its schema</div>`;
        layoutContainer.appendChild(detailsPanel);

        // --- Render Accordion Items ---
        const accordionContainer = sidebar.querySelector('#accordion-container');

        MIDDLE_LAYER_DATA.forEach((table, index) => {
            const item = document.createElement('div');
            item.className = 'accordion-table-item border-bottom border-light';
            if (index === 0) item.classList.add('active', 'expanded');

            // Type badge color
            const isFact = table.type === 'fact';
            const badgeClass = isFact ? 'bg-info bg-opacity-10 text-info' : 'bg-purple bg-opacity-10 text-purple';

            // Create bullet points HTML
            const bulletsHTML = table.bullets.map(b => `
                <div class="d-flex align-items-start gap-2 mb-1">
                    <span class="text-success small mt-1">●</span>
                    <span class="text-secondary small">${b}</span>
                </div>
            `).join('');

            item.innerHTML = `
                <div class="accordion-header p-3 cursor-pointer">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-chevron-right accordion-chevron text-secondary transition-transform" style="font-size:0.8rem;"></i>
                        <span class="fw-semibold text-headings small">${table.name}</span>
                        <span class="badge ${badgeClass} rounded-pill small" style="font-size:0.65rem;">${table.type.toUpperCase()}</span>
                    </div>
                </div>
                <div class="accordion-content overflow-hidden transition-all" style="max-height:0;">
                    <div class="p-3 pt-0 ps-4">
                        <div class="text-secondary small mb-2 border-start border-success ps-2 bg-success bg-opacity-10 rounded-end py-1">
                            ${table.impact}
                        </div>
                        <div class="accordion-bullets ps-1">
                            ${bulletsHTML}
                        </div>
                    </div>
                </div>
            `;

            // Expand first item by default
            if (index === 0) {
                const content = item.querySelector('.accordion-content');
                content.style.maxHeight = '500px';
                item.querySelector('.accordion-chevron').style.transform = 'rotate(90deg)';
                setTimeout(() => renderExplorerDetails(table), 50);
            }

            item.addEventListener('click', () => {
                // Collapse all others
                document.querySelectorAll('.accordion-table-item').forEach(i => {
                    i.classList.remove('active', 'expanded');
                    const c = i.querySelector('.accordion-content');
                    const ch = i.querySelector('.accordion-chevron');
                    if (c) c.style.maxHeight = '0';
                    if (ch) ch.style.transform = 'rotate(0deg)';
                });

                // Toggle current
                item.classList.add('active', 'expanded');
                const content = item.querySelector('.accordion-content');
                const chevron = item.querySelector('.accordion-chevron');
                content.style.maxHeight = '500px';
                chevron.style.transform = 'rotate(90deg)';

                renderExplorerDetails(table);
            });

            accordionContainer.appendChild(item);
        });
    }

    function renderExplorerDetails(table) {
        const container = document.getElementById('explorer-details');

        // Find Primary Key
        const pkCol = table.schema.find(c => c.name.includes('_id'));
        const pkName = pkCol ? pkCol.name : table.schema[0]?.name || 'id';

        // Type badge styling
        const isFact = table.type === 'fact';
        const badgeClass = isFact ? 'bg-info bg-opacity-10 text-info' : 'bg-purple bg-opacity-10 text-purple';

        // Build schema rows
        const rows = table.schema.map(col => `
            <tr class="schema-row border-bottom border-light">
                <td class="p-3">
                    <div class="fw-bold text-headings font-monospace small">${col.name}${col.name === pkName ? ' <span class="badge bg-warning text-dark ms-1">PK</span>' : ''}</div>
                </td>
                <td class="p-3 text-secondary small font-monospace">${col.type}</td>
                <td class="p-3 text-secondary small">${col.what}</td>
                <td class="p-3 text-secondary small">${col.why}</td>
                <td class="p-3 text-secondary small fst-italic">${col.how}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="table-detail-header p-4 border-bottom border-light">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <h2 class="h3 fw-bold text-headings mb-0 font-monospace">${table.name}</h2>
                    <span class="badge ${badgeClass} px-3 py-2 rounded-pill">${table.type.toUpperCase()}</span>
                </div>
                
                <p class="text-secondary lead fs-6 mb-4">
                    ${table.purpose}
                </p>

                <div class="d-flex gap-3 mb-4">
                    <div class="d-flex align-items-center gap-2 px-3 py-2 rounded bg-success bg-opacity-10 border border-success border-opacity-25">
                         <i class="bi bi-bar-chart-fill text-success"></i>
                         <span class="text-success fw-bold small">${table.impact}</span>
                    </div>
                     <div class="d-flex align-items-center gap-2 px-3 py-2 rounded bg-warning bg-opacity-10 border border-warning border-opacity-25">
                         <i class="bi bi-tools text-warning"></i>
                         <span class="text-warning fw-bold small">${table.pain}</span>
                    </div>
                </div>

                <div class="d-flex align-items-center gap-2 text-secondary small font-monospace">
                    <span class="fw-bold text-headings">Primary Key:</span>
                    <span class="text-primary">${pkName}</span>
                    <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">derived from usage</span>
                </div>
            </div>

            <div class="schema-grid-container p-0">
                <div class="d-flex justify-content-between align-items-center p-3 bg-body-tertiary border-bottom border-light">
                    <h4 class="mb-0 text-uppercase small fw-bold text-secondary tracking-wide">
                        Column Definitions
                    </h4>
                    <span class="text-secondary small">${table.schema.length} columns</span>
                </div>
                <div class="table-responsive">
                    <table class="table mb-0">
                        <thead class="bg-body-secondary">
                            <tr>
                                <th class="p-3 text-secondary small fw-bold text-uppercase border-bottom border-light" style="width:20%;">Column</th>
                                <th class="p-3 text-secondary small fw-bold text-uppercase border-bottom border-light" style="width:10%;">Type</th>
                                <th class="p-3 text-secondary small fw-bold text-uppercase border-bottom border-light" style="width:25%;">What it is</th>
                                <th class="p-3 text-secondary small fw-bold text-uppercase border-bottom border-light" style="width:25%;">Why it exists</th>
                                <th class="p-3 text-secondary small fw-bold text-uppercase border-bottom border-light" style="width:20%;">How calculated</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
                <div class="p-3 m-3 bg-info bg-opacity-10 border-start border-4 border-info rounded-end">
                    <p class="mb-0 text-secondary small">
                        <strong class="text-info">Key insight:</strong> Every column above can be traced back to observed query patterns. 
                        If a column can't answer <em>what</em>, <em>why</em>, and <em>how</em> — it shouldn't exist.
                    </p>
                </div>
            </div>
        `;
    }

    // Call init
    init();

});
