 # What 1,500 SQL Queries Reveal (ELI15)

This report analyzes **1,500 SQL queries executed in 2024**.
Instead of asking *what the data says*, we ask:

> **What does analyst SQL usage reveal about the business and the team?**

---

## 1. A small number of tables dominate everything

Most queries hit the same core tables again and again.

This means:
- performance wins here matter more than anywhere else,
- these tables are already acting like a “semantic layer,” just informally.

**Non‑obvious insight:**
Even without a formal middle layer, analysts have already *chosen* one by usage.

See `table_usage.csv`.

---

## 2. KPIs are reinvented constantly

The same KPIs—revenue, attendance rate, conversion rate—are recomputed hundreds of times.

Why this matters:
- Analysts spend time rebuilding logic instead of thinking.
- Optimizations don’t compound.
- Small formula differences go unnoticed.

**This is not a SQL problem. It’s a product opportunity.**

See `kpi_expression_reuse.csv`.

---

## 3. KPI names are reused, meanings are not

Aliases like `net_revenue` or `attendance_rate` appear everywhere.

But the SQL shows:
- different filters,
- different inclusions (fees, refunds),
- different grains.

**Non‑obvious insight:**
Dashboards can agree on a number and still be wrong in different ways.

See `kpi_alias_usage.csv`.

---

## 4. SQL shows where the data model is weak

Patterns like:
- `COUNT(DISTINCT ...)`
- repeated CASE statements
- temp tables

are *signals*, not style.

They mean:
- joins aren’t trusted,
- grain isn’t clear,
- intermediate concepts are missing.

**Analysts are paying an invisible tax in SQL.**

---

## 5. Time-of-day tells you which queries matter

Query timing reveals intent:
- Morning weekday queries → dashboards & exec reporting
- Weekly patterns → operational reviews
- Bursty clusters → investigations

**Actionable takeaway:**
Automate or materialize the predictable ones.
Keep ad‑hoc queries flexible.

See `hourly_activity.csv` and `day_of_week_activity.csv`.

---

## 6. A few analysts carry most of the load

A small group runs a large share of queries.

This usually means:
- they support recurring reporting,
- others depend on them for answers,
- knowledge is centralized in people, not systems.

**This is normal—and fixable with better abstractions.**

See `analyst_activity.csv`.

---

## What to do next

**Fast wins (weeks):**
- Standardize 5–10 KPIs.
- Materialize the most repeated calculations.

**Medium term (months):**
- Introduce a semantic/middle layer.
- Turn daily & weekly queries into parameterized assets.

**Long term:**
- Treat SQL usage like product telemetry.
- Continuously mine it for modeling and tooling gaps.

---

### One‑line summary

> *Your SQL already tells you where time, risk, and leverage live.
This analysis just makes it visible.*
