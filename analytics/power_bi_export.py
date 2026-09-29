import os
import sys
import pandas as pd
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.db.session import engine

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "exports"))
os.makedirs(OUTPUT_DIR, exist_ok=True)


def export_power_bi_star_schema():
    """
    Exports clean Dimensional Star Schema CSV files optimized for direct import into Power BI.
    Tables:
      - Fact_Loads
      - Dim_Carrier
      - Dim_Driver
      - Dim_Customer
      - Dim_Route
    """
    print("Exporting Power BI Dimensional Star Schema tables...")

    # 1. Fact_Loads
    fact_query = """
    SELECT 
        l.id as LoadKey,
        l.load_number as LoadNumber,
        l.customer_id as CustomerKey,
        l.carrier_id as CarrierKey,
        l.driver_id as DriverKey,
        l.origin_city || ', ' || l.origin_state || ' - ' || l.destination_city || ', ' || l.destination_state as RouteKey,
        l.pickup_datetime as PickupTimestamp,
        l.actual_pickup_datetime as ActualPickupTimestamp,
        l.delivery_datetime as DeliveryTimestamp,
        l.actual_delivery_datetime as ActualDeliveryTimestamp,
        l.distance_miles as DistanceMiles,
        l.load_type as EquipmentType,
        l.revenue as RevenueUSD,
        l.rate_per_mile as RatePerMileUSD,
        l.status as LoadStatus,
        CASE WHEN l.status = 'delayed' THEN 1 ELSE 0 END as IsDelayed,
        -- Delivered only; in_transit/pending are not on-time completions.
        CASE WHEN l.status = 'delivered' THEN 1 ELSE 0 END as IsDelivered
    FROM loads l;
    """
    fact_loads = pd.read_sql(fact_query, con=engine)
    fact_loads.to_csv(os.path.join(OUTPUT_DIR, "Fact_Loads.csv"), index=False)
    print(f"[OK] Fact_Loads exported: {len(fact_loads):,} rows.")

    # 2. Dim_Carrier
    carrier_query = """
    SELECT 
        id as CarrierKey,
        name as CarrierName,
        mc_number as MCNumber,
        dot_number as DOTNumber,
        location as BaseLocation,
        rating as CarrierRating,
        status as CarrierStatus,
        fleet_size as FleetSize,
        CASE 
            WHEN fleet_size >= 50 THEN 'Tier 1 Enterprise'
            WHEN fleet_size >= 20 THEN 'Tier 2 Mid-Market'
            ELSE 'Tier 3 Small Fleet'
        END as CarrierTier
    FROM carriers;
    """
    dim_carrier = pd.read_sql(carrier_query, con=engine)
    dim_carrier.to_csv(os.path.join(OUTPUT_DIR, "Dim_Carrier.csv"), index=False)
    print(f"[OK] Dim_Carrier exported: {len(dim_carrier):,} rows.")

    # 3. Dim_Driver
    driver_query = """
    SELECT 
        id as DriverKey,
        carrier_id as CarrierKey,
        name as DriverName,
        license_number as CDLNumber,
        experience_years as ExperienceYears,
        safety_score as SafetyScore,
        status as DutyStatus,
        CASE 
            WHEN experience_years >= 10 THEN 'Veteran'
            WHEN experience_years >= 4 THEN 'Senior'
            ELSE 'Junior'
        END as ExperienceBracket
    FROM drivers;
    """
    dim_driver = pd.read_sql(driver_query, con=engine)
    dim_driver.to_csv(os.path.join(OUTPUT_DIR, "Dim_Driver.csv"), index=False)
    print(f"[OK] Dim_Driver exported: {len(dim_driver):,} rows.")

    # 4. Dim_Customer
    customer_query = """
    SELECT 
        id as CustomerKey,
        name as CustomerName,
        code as CustomerCode,
        payment_terms as PaymentTerms
    FROM customers;
    """
    dim_customer = pd.read_sql(customer_query, con=engine)
    dim_customer.to_csv(os.path.join(OUTPUT_DIR, "Dim_Customer.csv"), index=False)
    print(f"[OK] Dim_Customer exported: {len(dim_customer):,} rows.")

    # 5. Dim_Route
    route_query = """
    SELECT DISTINCT
        origin_city || ', ' || origin_state || ' - ' || destination_city || ', ' || destination_state as RouteKey,
        origin_city as OriginCity,
        origin_state as OriginState,
        destination_city as DestinationCity,
        destination_state as DestinationState
    FROM loads;
    """
    dim_route = pd.read_sql(route_query, con=engine)
    dim_route.to_csv(os.path.join(OUTPUT_DIR, "Dim_Route.csv"), index=False)
    print(f"[OK] Dim_Route exported: {len(dim_route):,} rows.")

    print(f"\n[OK] All Power BI star-schema tables successfully generated in: {OUTPUT_DIR}")


if __name__ == "__main__":
    export_power_bi_star_schema()
