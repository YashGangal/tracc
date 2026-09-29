import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.db.models import Base
from app.db.migrations import apply_migrations

logger = logging.getLogger(__name__)

# Determine active database engine
ACTIVE_DB_URL = settings.DATABASE_URL
engine = None

if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    logger.info("Using local SQLite database: %s", settings.DATABASE_URL)
else:
    try:
        test_engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 2})
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = test_engine
        logger.info("Successfully connected to primary PostgreSQL database.")
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to local SQLite database: {settings.SQLITE_FALLBACK_URL}")
        try:
            test_engine.dispose()
        except Exception:
            pass
        ACTIVE_DB_URL = settings.SQLITE_FALLBACK_URL
        engine = create_engine(
            settings.SQLITE_FALLBACK_URL,
            connect_args={"check_same_thread": False}
        )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Apply the tracked schema baseline and create missing tables."""
    apply_migrations(engine)


def get_db():
    """Dependency for API routes providing a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def execute_read_only_query(query: str, max_rows: int = 50):
    """
    Safely execute a validated read-only SQL query and return headers and rows.
    """
    with engine.connect() as connection:
        if ACTIVE_DB_URL.startswith("postgresql"):
            # SET LOCAL is only valid inside a transaction block.
            with connection.begin():
                connection.execute(text(f"SET LOCAL statement_timeout = {settings.SQL_QUERY_TIMEOUT_MS}"))
                result = connection.execute(text(query))
                columns = list(result.keys())
                rows = [list(row) for row in result.fetchmany(max_rows)]
        else:
            result = connection.execute(text(query))
            columns = list(result.keys())
            rows = [list(row) for row in result.fetchmany(max_rows)]
        # Convert any non-serializable objects (datetime, Decimal) to strings
        formatted_rows = []
        for row in rows:
            formatted_row = []
            for item in row:
                if hasattr(item, "isoformat"):
                    formatted_row.append(item.isoformat())
                else:
                    formatted_row.append(item)
            formatted_rows.append(formatted_row)
        return columns, formatted_rows
