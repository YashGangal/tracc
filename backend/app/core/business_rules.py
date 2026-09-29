"""Central business rules and tunable thresholds (single source of truth).

Every operational constant lives here so dispatch policy (risk bands, review
windows, breach levels, planning assumptions) can be tuned without hunting
through services, endpoints, and seed scripts.
"""

# Delay-risk bands: predicted late probability -> LOW / MEDIUM / HIGH.
RISK_HIGH_THRESHOLD = 0.65
RISK_MEDIUM_THRESHOLD = 0.30

# Rolling review window for carrier health monitoring.
ROLLING_WINDOW_DAYS = 14

# Carrier late-delivery rate (%, rolling window) that triggers a breach alert.
CARRIER_BREACH_LATE_RATE_PCT = 15.0

# Planning assumption for transit-time estimates (miles per hour).
AVG_TRUCK_MPH = 48.0
