# Power BI Operational Analytics Integration

This directory contains automated star-schema exports and DAX formulations for building executive and operational dashboards in **Microsoft Power BI**.

---

## 1. Exporting Star Schema Tables

Run the exporter script from the workspace root:

```bash
python analytics/power_bi_export.py
```

The script extracts 5 clean dimensional and fact tables into `analytics/exports/`:
1. `Fact_Loads.csv`: 10,000 load transactions with timestamps, revenues, and delay classifications.
2. `Dim_Carrier.csv`: 500 carrier demographic records with safety tiers, fleet sizes, and ratings.
3. `Dim_Driver.csv`: 2,000 driver records with safety ratings and experience brackets.
4. `Dim_Customer.csv`: Enterprise customer records with credit and payment terms.
5. `Dim_Route.csv`: Interstate lanes and city/state geographic keys.

---

## 2. Power BI Data Model (Star Schema Relationships)

Connect the tables in Power BI's Model View with **1-to-Many (1:*) single directional filters**:

- `Dim_Carrier[CarrierKey]` (1) ──> `Fact_Loads[CarrierKey]` (*)
- `Dim_Driver[DriverKey]` (1) ──> `Fact_Loads[DriverKey]` (*)
- `Dim_Customer[CustomerKey]` (1) ──> `Fact_Loads[CustomerKey]` (*)
- `Dim_Route[RouteKey]` (1) ──> `Fact_Loads[RouteKey]` (*)

---

## 3. Recommended DAX Measures

Create a dedicated `_Measures` table in Power BI and paste the following production DAX calculations:

### 1. Total Operational Revenue
```dax
Total Revenue = SUM(Fact_Loads[RevenueUSD])
```

### 2. On-Time Delivery Rate (OTD %)
```dax
On-Time Delivery Rate = 
DIVIDE(
    CALCULATE(COUNTROWS(Fact_Loads), Fact_Loads[IsDeliveredOnTime] = 1),
    CALCULATE(COUNTROWS(Fact_Loads), Fact_Loads[LoadStatus] IN {"delivered", "delayed"}),
    1.0
)
```

### 3. Total Delayed Loads
```dax
Delayed Loads Count = CALCULATE(COUNTROWS(Fact_Loads), Fact_Loads[IsDelayed] = 1)
```

### 4. Average Revenue Per Mile (RPM)
```dax
Average RPM = 
DIVIDE(
    [Total Revenue],
    SUM(Fact_Loads[DistanceMiles]),
    0
)
```

### 5. Carrier Delay Frequency %
```dax
Carrier Delay Rate = 
DIVIDE(
    [Delayed Loads Count],
    COUNTROWS(Fact_Loads),
    0
)
```

---

## 4. Visual Layout Guide

- **Top Row (KPI Cards):** Total Revenue ($), Total Loads, On-Time Delivery Rate (%), Active Delayed Loads.
- **Middle Row Left:** Area Chart of Revenue & Load Volume by Month/Week.
- **Middle Row Right:** Donut Chart of Loads by Equipment Type (Dry Van, Reefer, Flatbed).
- **Bottom Left:** Clustered Bar Chart: Top 10 Carriers by Volume vs. On-Time % (Dual Axis).
- **Bottom Right:** Matrix of Lanes (`OriginState -> DestinationState`) with Volume, Avg Miles, and Delay Rate.
