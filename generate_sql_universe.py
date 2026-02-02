"""
Generate sql_universe.csv from execution_log.jsonl
Each row = one sql_id with all required columns for visualization
"""

import json
import pandas as pd
from collections import Counter
from datetime import datetime

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
            'tables': [],
            'kpis': set(),
            'archetype': exec_record.get('archetype', 'unknown'),
            'analyst': exec_record.get('analyst', 'unknown'),
            'execution_dates': [],
            'execution_hours': [],
            'execution_days': []
        }
    
    sql_id_data[sql_id]['execution_count'] += 1
    
    # Collect tables
    if 'expected_sources' in exec_record:
        sql_id_data[sql_id]['tables'].extend(exec_record['expected_sources'])
    
    # Collect KPIs
    if 'expected_kpis' in exec_record:
        kpi_names = [kpi.get('name', '') for kpi in exec_record['expected_kpis']]
        sql_id_data[sql_id]['kpis'].update(kpi_names)
    
    # Collect execution timestamps
    if 'created_ts' in exec_record:
        try:
            dt = datetime.strptime(exec_record['created_ts'], '%Y-%m-%d %H:%M:%S')
            sql_id_data[sql_id]['execution_dates'].append(dt)
            sql_id_data[sql_id]['execution_hours'].append(dt.hour)
            sql_id_data[sql_id]['execution_days'].append(dt.strftime('%A'))
        except:
            pass

print(f"Found {len(sql_id_data)} unique sql_ids")

# Convert to DataFrame
rows = []
for sql_id, data in sql_id_data.items():
    # Determine frequency bucket
    count = data['execution_count']
    if count >= 30:
        freq_bucket = 'daily'
    elif count >= 4:
        freq_bucket = 'weekly'
    elif count >= 2:
        freq_bucket = 'monthly'
    else:
        freq_bucket = 'ad-hoc'
    
    # Find primary table (most frequently used)
    if data['tables']:
        table_counts = Counter(data['tables'])
        primary_table = table_counts.most_common(1)[0][0]
    else:
        primary_table = 'none'
    
    # Find dominant hour
    if data['execution_hours']:
        hour_counts = Counter(data['execution_hours'])
        dominant_hour = hour_counts.most_common(1)[0][0]
    else:
        dominant_hour = 12  # default to noon
    
    # Find dominant day of week
    if data['execution_days']:
        day_counts = Counter(data['execution_days'])
        dominant_day_of_week = day_counts.most_common(1)[0][0]
    else:
        dominant_day_of_week = 'Monday'
    
    rows.append({
        'sql_id': sql_id,
        'num_tables_used': len(set(data['tables'])),
        'num_kpis': len(data['kpis']),
        'primary_table': primary_table,
        'kpi_family': data['archetype'],
        'execution_count': data['execution_count'],
        'frequency_bucket': freq_bucket,
        'analyst': data['analyst'],
        'dominant_hour': dominant_hour,
        'dominant_day_of_week': dominant_day_of_week
    })

df = pd.DataFrame(rows)

# Verify required columns
required_cols = [
    'sql_id', 'num_tables_used', 'num_kpis', 'primary_table', 
    'kpi_family', 'execution_count', 'frequency_bucket', 
    'analyst', 'dominant_hour', 'dominant_day_of_week'
]

print(f"\nGenerated {len(df)} rows")
print(f"Columns: {list(df.columns)}")
print(f"\nData summary:")
print(f"  num_tables_used: {df['num_tables_used'].min()}-{df['num_tables_used'].max()}")
print(f"  num_kpis: {df['num_kpis'].min()}-{df['num_kpis'].max()}")
print(f"  execution_count: {df['execution_count'].min()}-{df['execution_count'].max()}")
print(f"  frequency_bucket: {df['frequency_bucket'].value_counts().to_dict()}")
print(f"  kpi_family: {df['kpi_family'].nunique()} unique values")
print(f"  primary_table: {df['primary_table'].nunique()} unique values")

# Save to CSV
output_file = 'sql_universe.csv'
df.to_csv(output_file, index=False)
print(f"\nSaved to: {output_file}")

