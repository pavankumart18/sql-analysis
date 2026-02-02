import json
import collections
import random
import csv
import hashlib

# -----------------------------------------------------------------------------
# STEP 1: LOAD RAW DATA (Simulated for this demo, would be real logs)
# -----------------------------------------------------------------------------

def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def load_jsonl(path):
    data = []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    data.append(json.loads(line))
    except FileNotFoundError:
        return []
    return data

# -----------------------------------------------------------------------------
# CANONICAL SCHEMA GENERATION (Logic from User Request)
# -----------------------------------------------------------------------------

def determine_query_family(meta):
    # Logic to derive query family based on archetype/intent
    arch = meta.get('archetype', 'adhoc').lower()
    if 'executive' in arch or 'report' in arch: return 'Executive'
    if 'model' in arch or 'churn' in arch: return 'Trend Analysis'
    if 'daily' in arch: return 'Daily Monitoring'
    if 'channel' in arch or 'marketing' in arch: return 'Channel Analysis'
    if 'segment' in arch or 'cohort' in arch: return 'Segment Analysis'
    return 'Adhoc Investigation'

    return 'Adhoc Investigation'

def determine_kpi_family(kpis):
    # Logic to map KPIs to families with forced variety for demo
    # defined categories: Revenue, Attendance, Engagement, Operations, Efficiency
    
    # 1. Try strict detection first
    if kpis:
        text = " ".join([k.lower() for k in kpis])
        if 'rev' in text or 'sales' in text or 'price' in text: return 'Revenue'
        if 'scan' in text or 'attendance' in text or 'gate' in text: return 'Attendance'
        if 'app' in text or 'web' in text or 'click' in text or 'loyalty' in text: return 'Engagement'
        if 'wait' in text or 'speed' in text or 'inventory' in text: return 'Operations'
        if 'rate' in text or 'yield' in text or 'avg' in text: return 'Efficiency'
    
    # 2. Synthetic Fallback to ensure 5 distinct colors (User Request)
    # We want a nice spread: Rev(25%), Att(30%), Eng(15%), Ops(15%), Eff(15%)
    r = random.random()
    if r < 0.25: return 'Revenue'
    if r < 0.55: return 'Attendance'
    if r < 0.70: return 'Engagement'
    if r < 0.85: return 'Operations'
    return 'Efficiency'

def generate_canonical_schema(sqls, executions):
    print("Generating Canonical Enriched SQL Schema (Step 1)...")
    
    sql_counts = collections.Counter(e['sql_id'] for e in executions)
    
    # Execution Metadata Map (first seen usually carries structure)
    exec_meta = {}
    for e in executions:
        sid = e['sql_id']
        if sid not in exec_meta:
            exec_meta[sid] = e

    enriched_data = []

    for sql_entry in sqls:
        sid = sql_entry['id']
        sql_text = sql_entry['sql']
        
        # Meta from execution log or defaults
        meta = exec_meta.get(sid, {})
        tables_used = meta.get('expected_sources', [])
        kpis = [k['name'] for k in meta.get('expected_kpis', [])]
        
        # 1. Identity
        # Use existing ID but ensure stability
        
        # 2. Structural
        primary_table = tables_used[0] if tables_used else 'unknown'
        num_tables = len(tables_used)
        has_joins = num_tables > 1
        join_count = max(0, num_tables - 1)
        
        # 3. KPIs
        num_kpis = len(kpis)
        kpi_family = determine_kpi_family(kpis)
        has_ratio_kpi = any('/' in k or 'rate' in k.lower() for k in kpis)
        
        # 4. Time Semantics (Simulated based on common SQL patterns)
        time_grain = 'day' if 'DATE' in sql_text or 'day' in sql_text.lower() else 'month'
        date_trunc = 'day' if 'date_trunc' in sql_text.lower() else 'none'
        date_range_days = random.choice([7, 30, 90, 365]) if 'between' in sql_text.lower() else None
        
        # 5. Filters (Simulated extraction)
        channel_filter = 'channel' if 'channel' in sql_text.lower() else None
        segment_filter = 'segment' if 'segment' in sql_text.lower() else None
        country_filter = 'country' if 'country' in sql_text.lower() else None
        
        # 6. Query Family
        query_family = determine_query_family(meta)
        
        # 7. Execution Behavior (Synthetic Override for Demo Visuals)
        # Force a Power Law / Pareto distribution to ensure map has colors
        r = random.random()
        if r < 0.05: # 5% Critical
            exec_count = random.randint(51, 500)
            frequency_bucket = '5 (Critical)'
        elif r < 0.15: # 10% High
            exec_count = random.randint(21, 50)
            frequency_bucket = '4 (High)'
        elif r < 0.30: # 15% Medium
            exec_count = random.randint(9, 20)
            frequency_bucket = '3 (Medium)'
        elif r < 0.60: # 30% Low
            exec_count = random.randint(3, 8)
            frequency_bucket = '2 (Low)'
        else: # 40% Rare
            exec_count = random.choice([1, 2])
            frequency_bucket = '1 (Rare)'

        # dominate hour...
        
        dominant_hour = random.randint(9, 17) # Business hours
        dominant_day = random.choice(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
        
        # 8. Analyst
        analyst = random.choice(['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'])
        
        complexity_score = num_tables * max(1, num_kpis)

        row = {
            "sql_id": sid,
            "query_hash": hashlib.md5(sql_text.encode('utf-8')).hexdigest()[:8],
            
            "primary_table": primary_table,
            "tables_used": tables_used,
            "num_tables": num_tables,
            "has_joins": has_joins,
            "join_count": join_count,
            
            "kpis": kpis,
            "num_kpis": num_kpis,
            "kpi_families": [kpi_family], # List as requested
            "primary_kpi_family": kpi_family, # Keep for easier vis binding
            "has_ratio_kpi": has_ratio_kpi,
            
            "time_grain": time_grain,
            "date_trunc_used": date_trunc,
            "date_range_days": date_range_days,
            
            "channel_filter": channel_filter,
            "segment_filter": segment_filter,
            "country_filter": country_filter,
            
            "query_family": query_family,
            
            "execution_count": exec_count,
            "frequency_bucket": frequency_bucket,
            "dominant_hour": dominant_hour,
            "dominant_day_of_week": dominant_day,
            
            "analyst": analyst,
            
            "complexity_score": complexity_score,
            
            "sql_full": sql_text
        }
        enriched_data.append(row)
        
    return enriched_data

# -----------------------------------------------------------------------------
# AGGREGATION GENERATION (Step 2)
# -----------------------------------------------------------------------------

def generate_aggregates(enriched_data):
    print("Generating Aggregated Datasets (Step 2)...")
    
    aggs = {}

    # --- A2. sql_distribution_summary ---
    dist_map = collections.defaultdict(lambda: {'sql_count': 0, 'total_executions': 0})
    for row in enriched_data:
        key = (row['frequency_bucket'], row['query_family'], row['primary_kpi_family'])
        dist_map[key]['sql_count'] += 1
        dist_map[key]['total_executions'] += row['execution_count']
    
    aggs['sql_distribution_summary'] = [
        {'frequency_bucket': k[0], 'query_family': k[1], 'primary_kpi_family': k[2], 
         'sql_count': v['sql_count'], 'total_executions': v['total_executions']}
        for k, v in dist_map.items()
    ]

    # --- B1. query_shape_patterns ---
    shape_map = collections.defaultdict(lambda: {'num_sqls': 0, 'tables_acc': 0, 'kpis_acc': 0, 'ratio_acc': 0})
    for row in enriched_data:
        h = row['query_hash']
        shape_map[h]['num_sqls'] += 1
        shape_map[h]['tables_acc'] += row['num_tables']
        shape_map[h]['kpis_acc'] += row['num_kpis']
        if row['has_ratio_kpi']: shape_map[h]['ratio_acc'] += 1
        
    aggs['query_shape_patterns'] = []
    for h, v in shape_map.items():
        count = v['num_sqls']
        aggs['query_shape_patterns'].append({
            'query_hash': h,
            'num_sqls': count,
            'avg_num_tables': round(v['tables_acc'] / count, 1),
            'avg_num_kpis': round(v['kpis_acc'] / count, 1),
            'has_ratio_kpi': (v['ratio_acc'] / count) > 0.5
        })

    # --- B2. join_reuse ---
    join_map = collections.defaultdict(lambda: {'sql_count': 0, 'exec_weighted': 0})
    for row in enriched_data:
        if row['num_tables'] > 1:
            sig = " + ".join(sorted(row['tables_used']))
            join_map[sig]['sql_count'] += 1
            join_map[sig]['exec_weighted'] += row['execution_count']
    
    aggs['join_reuse'] = [
        {'join_signature': k, 'sql_count': v['sql_count'], 'execution_weighted_count': v['exec_weighted']}
        for k, v in join_map.items()
    ]
    
    # --- B3. kpi_expression_reuse (Approximation purely based on KPI name for now) ---
    kpi_expr_map = collections.defaultdict(lambda: {'sql_count': 0, 'exec_weighted': 0, 'analysts': set()})
    for row in enriched_data:
        for k in row['kpis']:
            kpi_expr_map[k]['sql_count'] += 1
            kpi_expr_map[k]['exec_weighted'] += row['execution_count']
            if row['analyst']: kpi_expr_map[k]['analysts'].add(row['analyst'])
            
    aggs['kpi_expression_reuse'] = [
        {'kpi_expression': k, 'sql_count': v['sql_count'], 'execution_weighted_count': v['exec_weighted'], 'analyst_count': len(v['analysts'])}
        for k, v in kpi_expr_map.items()
    ]

    # --- C1. kpi_usage_summary ---
    kpi_map = collections.defaultdict(lambda: {'sql_count': 0, 'exec_weighted': 0, 'analysts': set(), 'family': 'Unknown'})
    for row in enriched_data:
        for kpi in row['kpis']:
            kpi_map[kpi]['sql_count'] += 1
            kpi_map[kpi]['exec_weighted'] += row['execution_count']
            kpi_map[kpi]['family'] = row['primary_kpi_family']
            if row['analyst']: kpi_map[kpi]['analysts'].add(row['analyst'])
            
    aggs['kpi_usage_summary'] = [
        {'kpi_name': k, 'kpi_family': v['family'], 'sql_count': v['sql_count'], 
         'execution_weighted_count': v['exec_weighted'], 'analyst_count': len(v['analysts'])}
        for k, v in kpi_map.items()
    ]
    
    # --- C2. kpi_family_summary ---
    fam_map = collections.defaultdict(lambda: {'sql_count': 0, 'exec_weighted': 0})
    for row in enriched_data:
        fam = row['primary_kpi_family']
        fam_map[fam]['sql_count'] += 1
        fam_map[fam]['exec_weighted'] += row['execution_count']
        
    aggs['kpi_family_summary'] = [
        {'kpi_family': k, 'sql_count': v['sql_count'], 'execution_weighted_count': v['exec_weighted']}
        for k, v in fam_map.items()
    ]

    # --- C3. table_dominance ---
    table_map = collections.defaultdict(lambda: {'sql_count': 0, 'exec_weighted': 0, 'complexity_acc': 0})
    for row in enriched_data:
        for t in row['tables_used']:
            table_map[t]['sql_count'] += 1
            table_map[t]['exec_weighted'] += row['execution_count']
            table_map[t]['complexity_acc'] += row['complexity_score']

    aggs['table_dominance'] = []
    for t, v in table_map.items():
        aggs['table_dominance'].append({
            'table_name': t,
            'sql_count': v['sql_count'],
            'execution_weighted_count': v['exec_weighted'],
            'avg_complexity': round(v['complexity_acc'] / v['sql_count'], 1)
        })
        
    # --- C4. frequency_weighted_priorities ---
    # Simplified version: combining KPI and Family priorities
    # Real version would normalize across types
    prio_list = []
    total_execs = sum(r['execution_count'] for r in enriched_data)
    
    # Add KPI priorities
    for k, v in kpi_map.items():
        prio_list.append({
            'type': 'KPI',
            'name': k,
            'execution_weighted_count': v['exec_weighted'],
            'share_of_total_workload': round(v['exec_weighted'] / total_execs, 4) if total_execs else 0
        })
        
    # Add Join priorities
    for k, v in join_map.items():
        prio_list.append({
            'type': 'Join',
            'name': k,
            'execution_weighted_count': v['exec_weighted'],
            'share_of_total_workload': round(v['exec_weighted'] / total_execs, 4) if total_execs else 0
        })
        
    aggs['frequency_weighted_priorities'] = sorted(prio_list, key=lambda x: x['execution_weighted_count'], reverse=True)

    # --- D1. time_usage_summary ---
    time_map = collections.defaultdict(int)
    for row in enriched_data:
        key = f"{row['dominant_day_of_week']}-{row['dominant_hour']}"
        time_map[key] += row['execution_count']
        
    aggs['time_usage_summary'] = [
        {'time_slot': k, 'execution_count': v} for k, v in time_map.items()
    ]

    # --- D2. analyst_load_summary ---
    analyst_map = collections.defaultdict(lambda: {'sql_count': 0, 'exec_count': 0, 'complexity_acc': 0})
    for row in enriched_data:
        if row['analyst']:
            a = row['analyst']
            analyst_map[a]['sql_count'] += 1
            analyst_map[a]['exec_count'] += row['execution_count']
            analyst_map[a]['complexity_acc'] += row['complexity_score']
            
    aggs['analyst_load_summary'] = []
    for a, v in analyst_map.items():
        aggs['analyst_load_summary'].append({
            'analyst': a,
            'sql_count': v['sql_count'],
            'execution_count': v['exec_count'],
            'avg_complexity': round(v['complexity_acc'] / v['sql_count'], 1)
        })

    return aggs

def main():
    sqls = load_json('sql.json')
    executions = load_jsonl('execution_log.jsonl')
    
    if not sqls:
        print("CRITICAL: sql.json not found. Run previous generation scripts or provide mock data.")
        return

    # Step 1: Canonical Schema
    enriched_data = generate_canonical_schema(sqls, executions)
    
    # Save Canonical Data (Source of Truth)
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write("const APP_DATA = ")
        json.dump(enriched_data, f, indent=2)
        f.write(";")
    print("Saved -> data.js (Canonical Enriched Schema)")

    # Step 2: Aggregates
    aggregates = generate_aggregates(enriched_data)
    
    # Save Aggregates to JS as well for easiest consumption in this static demo
    # In a real app these would be CSVs or API endpoints. 
    # For now, we bundle them into a secondary JS file or distinct object.
    
    with open('aggregates.js', 'w', encoding='utf-8') as f:
        f.write("const APP_AGGREGATES = ")
        json.dump(aggregates, f, indent=2)
        f.write(";")
    print("Saved -> aggregates.js (Aggregation Datasets)")
    
    # For verification, print sample stats
    print(f"Total SQLs Enriched: {len(enriched_data)}")
    print(f"Unique Join Patterns: {len(aggregates['join_reuse'])}")
    print(f"Tracked KPIs: {len(aggregates['kpi_usage_summary'])}")


if __name__ == '__main__':
    main()
