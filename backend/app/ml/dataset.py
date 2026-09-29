import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime
from sqlalchemy import text
from app.db.session import engine


def extract_features_df():
    """
    Extract feature matrix for late delivery prediction from the operational database.
    """
    query = """
    SELECT 
        l.id as load_id,
        l.distance_miles,
        l.load_type,
        l.revenue,
        l.rate_per_mile,
        l.pickup_datetime,
        l.actual_pickup_datetime,
        l.delivery_datetime,
        l.actual_delivery_datetime,
        l.status,
        c.rating as carrier_rating,
        c.fleet_size as carrier_fleet_size,
        d.experience_years as driver_experience,
        d.safety_score as driver_safety_score
    FROM loads l
    LEFT JOIN carriers c ON l.carrier_id = c.id
    LEFT JOIN drivers d ON l.driver_id = d.id
    WHERE l.status IN ('delivered', 'delayed')
    """
    df = pd.read_sql(query, con=engine)
    
    # Calculate features
    df["pickup_datetime"] = pd.to_datetime(df["pickup_datetime"])
    df["actual_pickup_datetime"] = pd.to_datetime(df["actual_pickup_datetime"])
    df["delivery_datetime"] = pd.to_datetime(df["delivery_datetime"])
    
    # Pickup delay in minutes (positive if delayed, 0 if on time or early)
    df["pickup_delay_minutes"] = (
        (df["actual_pickup_datetime"] - df["pickup_datetime"]).dt.total_seconds() / 60.0
    ).fillna(0.0)
    df["pickup_delay_minutes"] = df["pickup_delay_minutes"].clip(lower=0.0)

    # Day of week and scheduled transit hours
    df["pickup_day_of_week"] = df["pickup_datetime"].dt.dayofweek
    df["scheduled_transit_hours"] = (
        (df["delivery_datetime"] - df["pickup_datetime"]).dt.total_seconds() / 3600.0
    )

    # Carrier late historical rate approximation based on rating
    # Rating 5.0 -> ~5% late, Rating 3.0 -> ~35% late
    df["carrier_rating"] = df["carrier_rating"].fillna(4.2)
    df["carrier_late_rate"] = (5.0 - df["carrier_rating"]) * 0.15 + 0.05

    # Driver safety factor
    df["driver_safety_score"] = df["driver_safety_score"].fillna(90.0)
    df["driver_experience"] = df["driver_experience"].fillna(3)

    # High distance flag (> 800 miles)
    df["is_long_haul"] = (df["distance_miles"] > 800).astype(int)

    # One-hot encode load_type
    load_type_dummies = pd.get_dummies(df["load_type"], prefix="type", drop_first=False)
    
    # Binary target: 1 = delayed, 0 = delivered on time
    df["is_late"] = (df["status"] == "delayed").astype(int)

    feature_cols = [
        "distance_miles",
        "pickup_delay_minutes",
        "scheduled_transit_hours",
        "carrier_late_rate",
        "carrier_fleet_size",
        "driver_experience",
        "driver_safety_score",
        "is_long_haul",
        "pickup_day_of_week",
        "rate_per_mile"
    ]
    
    # Combine numeric and dummy columns
    X = pd.concat([df[feature_cols], load_type_dummies], axis=1).fillna(0.0)
    y = df["is_late"]

    return X, y, df
