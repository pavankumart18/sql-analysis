
document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        data: [],
        originalData: [], // Preserve original order for reset
        colorMode: 'frequency_bucket',
        layoutMode: 'grid',
        sortMode: 'none',
        filter: null,
        activeSection: 'section-a'
    };

    // Constants - Premium Color Palette
    const COLORS = {
        freq: {
            'High (>20)': '#22d3ee',   // Vibrant Cyan
            'Medium (5-20)': '#fbbf24', // Warm Amber
            'Low (<5)': '#fb7185'       // Soft Rose
        },
        kpiFamily: {
            'Revenue': '#3b82f6',    // Blue
            'Volume': '#10b981',     // Emerald
            'Efficiency': '#f59e0b'  // Amber
        },
        // Rich categorical palette for tables/families
        palette: [
            '#818cf8', // Indigo
            '#34d399', // Emerald
            '#f472b6', // Pink
            '#60a5fa', // Blue
            '#a78bfa', // Violet
            '#fbbf24', // Amber
            '#2dd4bf', // Teal
            '#fb923c', // Orange
            '#c084fc', // Purple
            '#4ade80'  // Green
        ]
    };

    // DOM Elements
    const universeContainer = document.getElementById('universe-container');
    const tooltip = document.getElementById('tooltip');
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('section');
    const legendContainer = document.getElementById('legend-container');

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
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update Buttons
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update Sections
                const targetId = btn.getAttribute('data-target');
                sections.forEach(sec => {
                    if (sec.id === targetId) sec.classList.add('active');
                    else sec.classList.remove('active');
                });
                state.activeSection = targetId;

                // If entering universe, reflow dots
                if (targetId === 'section-a') {
                    // Small stagger for "wow" effect
                    updateDots();
                    setTimeout(() => repositionDots(), 50);
                }
            });
        });
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
            universeContainer.innerHTML = '<div id="group-labels"></div>';

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
                    if (state.activeSection === 'section-a') repositionDots();
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
            // Try direct lookup first
            if (COLORS.freq[item.frequency_bucket]) {
                return COLORS.freq[item.frequency_bucket];
            }
            // Derive from execution_count if frequency_bucket doesn't match
            const execCount = item.execution_count || 1;
            if (execCount > 20) return COLORS.freq['High (>20)'];
            if (execCount >= 5) return COLORS.freq['Medium (5-20)'];
            return COLORS.freq['Low (<5)'];
        } else if (state.colorMode === 'kpi_family') {
            const family = item.primary_kpi_family || 'Volume';
            return COLORS.kpiFamily[family] || '#94a3b8';
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
            // Driven by APP_AGGREGATES.sql_distribution_summary if available, otherwise static
            const buckets = ['High (>20)', 'Medium (5-20)', 'Low (<5)'];
            buckets.forEach(label => {
                // Count from aggregate if possible
                let count = '';
                if (typeof APP_AGGREGATES !== 'undefined') {
                    const row = APP_AGGREGATES.sql_distribution_summary.filter(r => r.frequency_bucket === label);
                    const total = row.reduce((sum, r) => sum + r.sql_count, 0);
                    if (total) count = `(${total})`;
                }

                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-color" style="background:${COLORS.freq[label]}"></div>
                    <span>${label} <span style="color:#64748b; font-size:0.75rem;">${count}</span></span>
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
                let count = '';
                if (typeof APP_AGGREGATES !== 'undefined') {
                    // Sum counts for this family
                    const rows = APP_AGGREGATES.kpi_family_summary.filter(r => r.kpi_family === fam.name);
                    const total = rows.reduce((sum, r) => sum + r.sql_count, 0);
                    if (total) count = `(${total})`;
                }

                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-color" style="background:${fam.color}"></div>
                    <span>${fam.name} <span style="color:#64748b; font-size:0.75rem;">${count}</span></span>
                `;
                legendContainer.appendChild(item);
            });
        }
        else if (state.colorMode === 'query_family') {
            document.getElementById('legend-container').innerHTML = `<div style="color:#64748b; font-style:italic;">Categorical coloring by Intent</div>`;
        }
    }

    function repositionDots() {
        const labelContainer = document.getElementById('group-labels');
        if (labelContainer) labelContainer.innerHTML = '';

        const containerWidth = universeContainer.clientWidth;
        const containerHeight = universeContainer.clientHeight;

        // --- 1. GRID LAYOUT (The "Universe") ---
        if (state.layoutMode === 'grid') {
            const dotSize = 6; const gap = 1; const totalDotSize = dotSize + gap;

            // Standard Grid
            const cols = Math.floor(containerWidth / totalDotSize);
            const startX = 20;
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
                dot.style.transform = 'none';
            });

            // --- 2. STACKS (SandDance "Bar Chart" of particles) ---
        } else if (state.layoutMode === 'grouped') {
            // Config
            const dotSize = 6; const gap = 1; const totalDotSize = dotSize + gap;

            let groupKey = 'kpi_family';
            if (state.colorMode === 'frequency_bucket') groupKey = 'frequency_bucket';
            if (state.colorMode === 'primary_table') groupKey = 'primary_table';

            const groups = {};
            state.data.forEach((item) => {
                const key = item[groupKey] || 'Other';
                if (!groups[key]) groups[key] = [];
                groups[key].push({ item });
            });

            const groupNames = Object.keys(groups).sort();
            const numGroups = groupNames.length;

            // Layout params
            const padding = 20;
            const availWidth = containerWidth - (padding * 2);
            // Dynamic column width
            const colWidth = (availWidth / numGroups) - 10;
            const maxColWidth = Math.min(colWidth, 200); // Max width 200px
            const dotsPerRow = Math.max(2, Math.floor(maxColWidth / totalDotSize));

            // Centering
            const totalAssemblyW = numGroups * maxColWidth + (numGroups - 1) * 10;
            const startX = Math.max(20, (containerWidth - totalAssemblyW) / 2);

            // Anchor at bottom
            let maxStackHeight = 0;
            groupNames.forEach(name => {
                const count = groups[name].length;
                const rows = Math.ceil(count / dotsPerRow);
                const h = rows * totalDotSize;
                if (h > maxStackHeight) maxStackHeight = h;
            });
            const bottomY = Math.max(containerHeight - 100, maxStackHeight + 50);

            groupNames.forEach((name, gIndex) => {
                const groupItems = groups[name];
                const colX = startX + (gIndex * (maxColWidth + 10));

                // Labels
                if (labelContainer) {
                    const label = document.createElement('div');
                    label.className = 'group-label';
                    label.innerText = name;
                    label.style.left = `${colX}px`;
                    label.style.top = `${bottomY + 5}px`;
                    label.style.width = `${maxColWidth}px`;
                    labelContainer.appendChild(label);

                    const count = document.createElement('div');
                    count.className = 'axis-label';
                    count.innerText = groupItems.length;
                    count.style.left = `${colX}px`;
                    count.style.top = `${bottomY + 25}px`;
                    count.style.width = `${maxColWidth}px`;
                    count.style.textAlign = 'center';
                    labelContainer.appendChild(count);
                }

                groupItems.forEach((obj, i) => {
                    const dot = dotElements.get(obj.item.sql_id);
                    if (!dot) return;

                    const internalCol = i % dotsPerRow;
                    const internalRow = Math.floor(i / dotsPerRow);

                    // Center dots within the column width
                    const offsetX = (maxColWidth - (dotsPerRow * totalDotSize)) / 2;

                    const left = colX + (internalCol * totalDotSize) + offsetX;
                    const top = bottomY - (internalRow * totalDotSize);

                    dot.style.left = `${left}px`;
                    dot.style.top = `${top}px`;
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
            title: "1. Ingestion",
            fullName: "SQL Workload Ingestion",
            desc: "We start with what analysts actually ran.",
            tags: ["Raw Logs", "Filtering"],
            details: {
                in: "Historical SQL queries + Execution timestamps",
                out: "Cleaned, Deduplicated Query Stream",
                why: "This ensures the analysis reflects real usage, not hypothetical queries.",
                artifact: "sql.json / execution_log.jsonl"
            }
        },
        {
            title: "2. Parsing",
            fullName: "Parsing & Normalization",

            desc: "Raw SQL is converted into structured components.",
            tags: ["AST", "normalization"],
            details: {
                in: "Raw SQL Strings (e.g., 'select * from...')",
                out: "Abstract Syntax Tree (AST) & Signature Hash",
                why: "Once SQL is structured, it becomes analyzable at scale.",
                artifact: "normalized_ast.json"
            }
        },
        {
            title: "3. Extraction",
            fullName: "Feature Extraction",
            desc: "Each SQL becomes a comparable feature vector.",
            tags: ["Tables", "Joins", "KPIs"],
            details: {
                in: "AST Nodes",
                out: "Feature Vectors {tables, joins, filters}",
                why: "This is how thousands of unique SQLs become comparable.",
                artifact: "sql_universe.csv"
            }
        },
        {
            title: "4. Analysis",
            fullName: "Workload Analysis",
            desc: "Not all queries are equally important.",
            tags: ["Frequency", "Time"],
            details: {
                in: "Feature Vectors + Frequencies",
                out: "Usage Heatmaps & Graph Connectivity",
                why: "Usage patterns tell us which queries matter operationally.",
                artifact: "hourly_activity.csv"
            }
        },
        {
            title: "5. Patterns",
            fullName: "Pattern Discovery",
            desc: "Repeated logic reveals hidden structure.",
            tags: ["Clustering", "Reuse"],
            details: {
                in: "Usage Aggregates",
                out: "Semantic 'Archetypes' (Query Clusters)",
                why: "Many queries differ in syntax but share the same intent.",
                artifact: "query_shape_patterns.csv"
            }
        },
        {
            title: "6. Synthesis",
            fullName: "Middle Layer Synthesis",
            desc: "A reusable middle layer naturally emerges.",
            tags: ["DDL", "Optimization"],
            details: {
                in: "Archetype Definitions",
                out: "Proposed DDL (e.g., fact_revenue_daily)",
                why: "This layer is derived analytically from usage — not designed upfront.",
                artifact: "proposed_schema.sql"
            }
        }
    ];

    function renderSectionB() {
        const container = document.getElementById('process-stages-wrapper');
        container.innerHTML = `
            <div class="pipeline-container">
                <div class="pipeline-visual"></div>
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
                renderPipelineDetails(stage);
            });

            visualContainer.appendChild(node);
        });

        // Initialize with first stage
        renderPipelineDetails(PROCESS_STAGES[0]);
    }

    function renderPipelineDetails(stage) {
        const panel = document.getElementById('pipeline-details-panel');

        // --- DATA PROOF BINDING ---
        let proofHTML = '';
        if (typeof APP_AGGREGATES !== 'undefined') {
            let proofData = [];
            let proofTitle = '';

            // Map Stage to Aggregate
            if (stage.title.includes('Analysis')) {
                // Stage 4: Workload Analysis -> time_usage_summary
                proofData = APP_AGGREGATES.time_usage_summary ? APP_AGGREGATES.time_usage_summary.slice(0, 3) : [];
                proofTitle = 'time_usage_summary.csv';
            } else if (stage.title.includes('Patterns')) {
                // Stage 5: Patterns -> query_shape_patterns
                proofData = APP_AGGREGATES.query_shape_patterns ? APP_AGGREGATES.query_shape_patterns.slice(0, 3) : [];
                proofTitle = 'query_shape_patterns.csv';
            } else if (stage.title.includes('Extraction')) {
                // Stage 3: Extraction -> sql_universe.csv
                proofData = state.data.slice(0, 3).map(d => ({
                    sql_id: d.sql_id,
                    tables: (d.tables_used && d.tables_used.length) ? d.tables_used.join('+').substring(0, 20) + (d.tables_used.length > 2 ? '...' : '') : 'N/A',
                    fam: d.primary_kpi_family
                }));
                proofTitle = 'sql_universe.csv (Head)';
            } else if (stage.title.includes('Parsing')) {
                // Stage 2: Parsing & Normalization
                proofHTML = `
                    <div class="detail-block proof" style="margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                        <label style="color:#38bdf8; letter-spacing:0.05em; font-size:0.7rem; font-weight:700;">NORMALIZATION DEMO</label>
                        <div style="background:rgba(15,23,42,0.5); padding:8px; border-radius:4px; margin-top:8px; font-family:monospace; font-size:0.75rem;">
                            <div style="color:#ef4444; margin-bottom:4px;">In: SELECT * FROM sales</div>
                            <div style="color:#ef4444; margin-bottom:4px;">In: select * from SALES</div>
                            <div style="border-top:1px dashed #475569; margin:4px 0;"></div>
                            <div style="color:#22c55e;">Out: Hash(7a92c3...); Count=2</div>
                        </div>
                        <div style="font-size:0.7rem; color:#64748b; margin-top:4px; font-style:italic;">*Collapses variants into single structure</div>
                    </div>
                `;
            } else if (stage.title.includes('Ingestion')) {
                // Stage 1: Ingestion
                proofHTML = `
                    <div class="detail-block proof" style="margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                        <label style="color:#38bdf8; letter-spacing:0.05em; font-size:0.7rem; font-weight:700;">DATA PROOF</label>
                        <div style="font-size:1.2rem; color:#f8fafc; font-weight:600; margin-top:0.5rem;">
                            ${state.data.length.toLocaleString()} <span style="font-size:0.9rem; color:#94a3b8; font-weight:400;">Queries Ingested</span>
                        </div>
                        <div style="font-size:0.7rem; color:#64748b; margin-top:4px; font-style:italic;">*Real count from sql.json</div>
                    </div>
                `;
            } else if (stage.title.includes('Synthesis')) {
                // Stage 6: Synthesis
                proofHTML = `
                    <div class="detail-block proof" style="margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                        <label style="color:#38bdf8; letter-spacing:0.05em; font-size:0.7rem; font-weight:700;">OUTPUT PREVIEW</label>
                         <div style="margin-top:0.5rem; color:#cbd5e1; font-size:0.9rem;">
                             Generated <strong style="color:#fff;">3 Middle Layer Tables</strong> based on usage patterns.
                         </div>
                         <button onclick="document.querySelector('[data-target=section-c]').click()" style="margin-top:0.5rem; padding:4px 8px; background:#38bdf8; border:none; border-radius:4px; color:#0f172a; font-weight:600; cursor:pointer;">
                            View Middle Layer Schema →
                        </button>
                    </div>
                `;
            }

            if (proofData.length > 0) {
                // Render a mini table
                const keys = Object.keys(proofData[0]);
                const header = keys.map(k => `<th>${k}</th>`).join('');
                const rows = proofData.map(row =>
                    `<tr>${keys.map(k => `<td>${row[k]}</td>`).join('')}</tr>`
                ).join('');

                proofHTML = `
                    <div class="detail-block proof" style="margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                        <label style="color:#38bdf8; letter-spacing:0.05em; font-size:0.7rem; font-weight:700;">DATA PROOF: ${proofTitle}</label>
                        <table class="mini-table" style="width:100%; margin-top:0.5rem; font-size:0.75rem; color:#cbd5e1; border-collapse:collapse;">
                            <thead><tr style="text-align:left; border-bottom:1px solid #334155; color:#64748b;">${header}</tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                        <div style="font-size:0.7rem; color:#64748b; margin-top:4px; font-style:italic;">*Live sample from analysis pipeline</div>
                    </div>
                    `;
            }
        }

        panel.innerHTML = `
            <h3 class="detail-title">${stage.fullName}</h3>
            
            <div class="detail-grid">
                <div class="detail-block input">
                    <label>INPUT</label>
                    <p>${stage.details.in}</p>
                </div>
                <div class="detail-block output">
                    <label>OUTPUT</label>
                    <p>${stage.details.out}</p>
                </div>
            </div>

            <div class="detail-block why">
                <label>THE VISUAL REASONING</label>
                <p>${stage.details.why}</p>
            </div>
            
            ${proofHTML}

            <div class="detail-artifact">
                <span class="artifact-icon">📄</span> Artifact: <span class="artifact-name">${stage.details.artifact}</span>
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
                <div style="text-align:center; max-width:750px; margin:0 auto 1.5rem auto;">
                    <h2 style="color:#f8fafc; margin-bottom:0.5rem; font-size:1.4rem;">The Derived Middle Layer</h2>
                    <p style="color:#94a3b8; font-size:1rem; line-height:1.6; margin:0;">
                        Based on how analysts <strong style="color:#38bdf8;">actually query data</strong>, 
                        this is the small, reusable layer that <em style="color:#cbd5e1;">naturally emerges</em>.
                    </p>
                    <p style="color:#64748b; font-size:0.85rem; margin-top:0.5rem; font-style:italic;">
                        Nothing here was designed upfront — it all emerged from observed usage patterns.
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
        sidebar.className = 'explorer-sidebar';
        sidebar.innerHTML = `
            <div class="explorer-header">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                Derived Tables
                <span style="margin-left:auto; color:#64748b; font-size:0.75rem;">${MIDDLE_LAYER_DATA.length} tables</span>
            </div>
            <div id="accordion-container" style="overflow-y:auto; flex:1;"></div>
        `;
        layoutContainer.appendChild(sidebar);

        // --- Right: Schema Details Panel ---
        const detailsPanel = document.createElement('div');
        detailsPanel.className = 'schema-panel';
        detailsPanel.id = 'explorer-details';
        detailsPanel.innerHTML = `<div class="placeholder-text">Select a table to view its schema</div>`;
        layoutContainer.appendChild(detailsPanel);

        // --- Render Accordion Items ---
        const accordionContainer = sidebar.querySelector('#accordion-container');

        MIDDLE_LAYER_DATA.forEach((table, index) => {
            const item = document.createElement('div');
            item.className = 'accordion-table-item';
            if (index === 0) item.classList.add('active', 'expanded');

            // Type badge color
            const badgeColor = table.type === 'fact' ? '#38bdf8' : '#a78bfa';
            const badgeBg = table.type === 'fact' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(167, 139, 250, 0.15)';

            // Create bullet points HTML
            const bulletsHTML = table.bullets.map(b => `
                <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:4px;">
                    <span style="color:#4ade80; font-size:0.7rem; margin-top:2px;">●</span>
                    <span style="color:#94a3b8; font-size:0.8rem; line-height:1.4;">${b}</span>
                </div>
            `).join('');

            item.innerHTML = `
                <div class="accordion-header" style="cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                        <svg class="accordion-chevron" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="transition:transform 0.2s; flex-shrink:0;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                        <span style="color:#f1f5f9; font-weight:600; font-size:0.95rem;">${table.name}</span>
                        <span style="background:${badgeBg}; color:${badgeColor}; font-size:0.65rem; padding:2px 6px; border-radius:10px; font-weight:600; text-transform:uppercase;">${table.type}</span>
                    </div>
                </div>
                <div class="accordion-content" style="overflow:hidden; max-height:0; transition:max-height 0.3s ease;">
                    <div style="color:#cbd5e1; font-size:0.85rem; line-height:1.5; margin-bottom:8px;">
                        ${table.purpose}
                    </div>
                    <div style="background:rgba(74, 222, 128, 0.1); border-left:2px solid #4ade80; padding:6px 10px; margin-bottom:10px; border-radius:0 4px 4px 0;">
                        <span style="color:#4ade80; font-weight:600; font-size:0.8rem;">${table.impact}</span>
                    </div>
                    <div class="accordion-bullets">
                        ${bulletsHTML}
                    </div>
                </div>
            `;

            // Expand first item by default
            if (index === 0) {
                const content = item.querySelector('.accordion-content');
                content.style.maxHeight = content.scrollHeight + 'px';
                item.querySelector('.accordion-chevron').style.transform = 'rotate(90deg)';
            }

            item.addEventListener('click', () => {
                const isExpanded = item.classList.contains('expanded');
                const content = item.querySelector('.accordion-content');
                const chevron = item.querySelector('.accordion-chevron');

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
                content.style.maxHeight = content.scrollHeight + 'px';
                chevron.style.transform = 'rotate(90deg)';

                renderExplorerDetails(table);
            });

            accordionContainer.appendChild(item);
        });

        // Initial Render
        if (MIDDLE_LAYER_DATA.length > 0) renderExplorerDetails(MIDDLE_LAYER_DATA[0]);
    }

    function renderExplorerDetails(table) {
        const container = document.getElementById('explorer-details');

        // Find Primary Key
        const pkCol = table.schema.find(c => c.name.includes('_id'));
        const pkName = pkCol ? pkCol.name : table.schema[0]?.name || 'id';

        // Type badge styling
        const badgeColor = table.type === 'fact' ? '#38bdf8' : '#a78bfa';
        const badgeBg = table.type === 'fact' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(167, 139, 250, 0.2)';

        // Build schema rows with all 5 columns: Name, Type, What, Why, How
        const rows = table.schema.map(col => `
            <tr>
                <td>
                    <div class="col-name">${col.name}${col.name === pkName ? ' <span class="flag-pk">PK</span>' : ''}</div>
                </td>
                <td class="col-type">${col.type}</td>
                <td style="color:#e2e8f0;">${col.what}</td>
                <td style="color:#94a3b8;">${col.why}</td>
                <td style="color:#64748b; font-style:italic;">${col.how}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="table-detail-header">
                <div class="table-title-row">
                    <h2>${table.name}</h2>
                    <span class="type-badge" style="background:${badgeBg}; color:${badgeColor};">${table.type.toUpperCase()}</span>
                </div>
                
                <p style="color:#e2e8f0; line-height:1.6; max-width:800px; margin:0.5rem 0 1rem 0; font-size:0.95rem;">
                    ${table.purpose}
                </p>

                <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1rem;">
                    <div style="background:rgba(74, 222, 128, 0.1); border:1px solid rgba(74, 222, 128, 0.3); padding:8px 14px; border-radius:6px;">
                        <span style="color:#4ade80; font-weight:600; font-size:0.85rem;">📊 ${table.impact}</span>
                    </div>
                    <div style="background:rgba(251, 146, 60, 0.1); border:1px solid rgba(251, 146, 60, 0.3); padding:8px 14px; border-radius:6px;">
                        <span style="color:#fb923c; font-weight:600; font-size:0.85rem;">🔧 ${table.pain}</span>
                    </div>
                </div>

                <div class="pk-box">
                    <span class="pk-label">Primary Key:</span>
                    <span class="pk-val">${pkName}</span>
                    <span class="confidence-badge" style="background:rgba(74,222,128,0.2); color:#4ade80;">derived from usage</span>
                </div>
            </div>

            <div class="schema-grid-container">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h4 style="margin:0; color:#94a3b8; text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em;">
                        Column Definitions
                    </h4>
                    <span style="color:#64748b; font-size:0.75rem;">${table.schema.length} columns</span>
                </div>
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th style="width:18%;">Column</th>
                            <th style="width:10%;">Type</th>
                            <th style="width:24%;">What it is</th>
                            <th style="width:28%;">Why it exists</th>
                            <th style="width:20%;">How calculated</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <div style="margin-top:1.5rem; padding:1rem; background:rgba(56,189,248,0.05); border-radius:8px; border-left:3px solid #38bdf8;">
                    <p style="margin:0; color:#94a3b8; font-size:0.85rem; line-height:1.6;">
                        <strong style="color:#38bdf8;">Key insight:</strong> Every column above can be traced back to observed query patterns. 
                        If a column can't answer <em>what</em>, <em>why</em>, and <em>how</em> — it shouldn't exist.
                    </p>
                </div>
            </div>
        `;
    }

    // Call init
    init();

});
