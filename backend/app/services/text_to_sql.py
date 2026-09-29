import re
import time
import logging
from typing import Tuple, List, Dict, Any, Optional
from app.core.ai_provider import AIProvider
from app.core.config import settings
from app.db.session import execute_read_only_query
from app.schemas.logistics import SQLQueryResult

logger = logging.getLogger(__name__)

# Allowed tables in read-only queries (users table is strictly excluded for security)
ALLOWED_TABLES = {
    "loads", "carriers", "drivers", "trucks", "customers", 
    "shipments", "delivery_events", "invoices", "compliance_records", "alerts"
}

FORBIDDEN_KEYWORDS = [
    r"\binsert\b", r"\bupdate\b", r"\bdelete\b", r"\bdrop\b", 
    r"\balter\b", r"\btruncate\b", r"\bgrant\b", r"\brevoke\b", 
    r"\bexec\b", r"\bexecute\b", r"\bcreate\b", r"\binto\b",
    r"\bpg_\b", r"\binformation_schema\b", r"\bsqlite_master\b"
]

SCHEMA_CONTEXT = """
Database Tables and Columns:
- loads (id, load_number, customer_id, carrier_id, driver_id, truck_id, origin_city, origin_state, destination_city, destination_state, pickup_datetime, actual_pickup_datetime, delivery_datetime, actual_delivery_datetime, distance_miles, load_type ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck'], revenue, rate_per_mile, status ['pending', 'assigned', 'in_transit', 'delivered', 'delayed', 'cancelled'], created_at)
- carriers (id, name, mc_number, dot_number, location, rating, status ['active', 'probation', 'suspended'], fleet_size, created_at)
- drivers (id, carrier_id, name, license_number, experience_years, safety_score, status ['available', 'on_duty', 'resting', 'off_duty'], created_at)
- trucks (id, carrier_id, truck_number, truck_type ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck'], model_year, status, created_at)
- customers (id, name, code, contact_email, payment_terms, created_at)
- shipments (id, load_id, weight_lbs, commodity, pieces, special_instructions)
- delivery_events (id, load_id, event_type ['pickup_arrival', 'departed_origin', 'gps_ping', 'delay_reported', 'delivery_arrival', 'delivered'], event_timestamp, location, description, delay_minutes)
- invoices (id, load_id, invoice_number, amount, status ['issued', 'paid', 'overdue', 'disputed'], invoice_date, paid_date)
- compliance_records (id, carrier_id, driver_id, record_type, status ['valid', 'expired', 'pending_review', 'failed'], expiry_date)
- alerts (id, alert_type ['delayed_load', 'daily_ops_report', 'high_risk_carrier', 'high_risk_load'], severity ['low', 'medium', 'high', 'critical'], load_id, carrier_id, title, message, status ['active', 'acknowledged', 'resolved'], created_at)
"""


def validate_sql(query: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that the generated query is strictly a safe read-only SELECT statement.
    """
    cleaned = query.strip().rstrip(";")

    if not cleaned:
        return False, "Query cannot be empty."
    if len(cleaned) > settings.SQL_QUERY_MAX_LENGTH:
        return False, f"Query exceeds the {settings.SQL_QUERY_MAX_LENGTH}-character limit."
    
    # Must begin with SELECT or WITH (for CTEs)
    if not (cleaned.upper().startswith("SELECT") or cleaned.upper().startswith("WITH")):
        return False, "Query must start with SELECT."

    # Check for disallowed multiple semicolon statements
    if ";" in cleaned:
        return False, "Multiple SQL statements in a single execution are prohibited."

    # Check for forbidden keywords (DML, DDL, system catalogs)
    for pattern in FORBIDDEN_KEYWORDS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            return False, f"Forbidden keyword detected in query: pattern '{pattern}'"

    # Strictly disallow accessing users table
    if re.search(r"\busers\b", cleaned, re.IGNORECASE):
        return False, "Access to the 'users' security table is restricted."

    # Check that referenced tables are in ALLOWED_TABLES.
    # Handles aliases, quoted identifiers, schema prefixes, comma-joined tables, and CTE names.
    cte_names: set[str] = set()
    if cleaned.upper().startswith("WITH"):
        for m in re.finditer(r"([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(", cleaned, re.IGNORECASE):
            cte_names.add(m.group(1).lower())
    for m in re.finditer(
        r"\b(?:FROM|JOIN)\s+((?:[\"'`\[]?[a-zA-Z_][a-zA-Z0-9_\.]*[\"'`\]]?\s*(?:AS\s+[a-zA-Z_][a-zA-Z0-9_]*\s*)?,?\s*)+)",
        cleaned,
        re.IGNORECASE,
    ):
        table_list = m.group(1)
        for part in re.split(r",", table_list):
            part = part.strip()
            if not part:
                continue
            first_token = re.split(r"\s+", part, maxsplit=1)[0]
            raw_tbl = first_token.lower()
            # Strip schema prefix (e.g. public.loads -> loads) and quotes/brackets.
            tbl = raw_tbl.split(".")[-1].strip("\"'`[]")
            if tbl in cte_names:
                continue
            if not re.fullmatch(r"[a-z_][a-z0-9_]*", tbl):
                return False, f"Table '{tbl}' is not in the allowed operational tables whitelist."
            if tbl not in ALLOWED_TABLES:
                return False, f"Table '{tbl}' is not in the allowed operational tables whitelist."

    # Every LIMIT in the query (including subqueries) must respect the cap.
    for limit_match in re.finditer(r"\blimit\s+(\d+)\b", cleaned, re.IGNORECASE):
        if int(limit_match.group(1)) > settings.SQL_QUERY_MAX_ROWS:
            return False, f"Query LIMIT cannot exceed {settings.SQL_QUERY_MAX_ROWS} rows."

    return True, None


async def execute_text_to_sql(user_query: str) -> SQLQueryResult:
    """
    Translates natural language to SQL, validates security, executes, and synthesizes results.
    """
    start_time = time.time()
    system_prompt = f"""You are an expert AI SQL Engineer for a US Logistics and Freight Operations platform.
Convert the user's natural language question into a single, highly-optimized, read-only SQL SELECT query.

{SCHEMA_CONTEXT}

RULES:
1. ONLY return the raw SQL query. Do not wrap in markdown quotes or backticks.
2. Only write read-only SELECT queries.
3. Use standard SQL compatible with PostgreSQL and SQLite.
4. If the user asks for rates or averages, use ROUND(..., 2).
5. Always limit output to at most 50 rows if unbounded (add LIMIT 50).
6. DO NOT query the 'users' table.
"""

    raw_sql = await AIProvider.generate_completion(
        prompt=f"User question: {user_query}",
        system_prompt=system_prompt,
        temperature=0.0
    )

    # Clean markdown if returned
    raw_sql = raw_sql.replace("```sql", "").replace("```", "").strip()
    
    # Ensure LIMIT clause exists if unbounded
    if "limit" not in raw_sql.lower() and "count(" not in raw_sql.lower() and "sum(" not in raw_sql.lower():
        raw_sql = raw_sql.rstrip(";") + f" LIMIT {settings.SQL_QUERY_MAX_ROWS};"

    # Validate security
    is_valid, error_msg = validate_sql(raw_sql)
    if not is_valid:
        raise ValueError(f"SQL Security Validation Rejected Query: {error_msg}")

    # Execute read-only query
    attempted_sql = raw_sql
    fallback_used = False
    fallback_note = ""
    try:
        columns, rows = execute_read_only_query(raw_sql, max_rows=settings.SQL_QUERY_MAX_ROWS)
    except Exception as e:
        logger.error(f"SQL execution error: {e}")
        # Fallback to standard safe query, but disclose it transparently.
        safe_fallback = "SELECT load_number, origin_city, destination_city, status, revenue FROM loads ORDER BY pickup_datetime DESC LIMIT 10;"
        columns, rows = execute_read_only_query(safe_fallback, max_rows=10)
        raw_sql = safe_fallback
        fallback_used = True
        fallback_note = f" The requested query failed to execute ({e}); a safe default load listing was returned instead."

    exec_time = round((time.time() - start_time) * 1000, 2)

    # Generate human explanation/summary
    explanation_prompt = f"""Summarize these logistics query results concisely for a freight dispatcher or operations manager:
User question: {user_query}
Query executed: {raw_sql}
Columns: {columns}
Sample rows: {rows[:8]}
Total rows returned: {len(rows)}
"""
    explanation = await AIProvider.generate_completion(
        prompt=explanation_prompt,
        system_prompt="You are an AI Logistics Operations Copilot summarizing operational data concisely and accurately.",
        temperature=0.2
    )
    explanation_text = (explanation or "").strip() or "Query executed successfully against live operational data."
    if fallback_used:
        explanation_text = f"[Note: attempted query failed validation/execution; returned safe fallback. Attempted: {attempted_sql}]{fallback_note} {explanation_text}"

    return SQLQueryResult(
        generated_sql=raw_sql,
        explanation=explanation_text,
        columns=columns,
        rows=rows,
        execution_time_ms=exec_time,
        row_count=len(rows)
    )
